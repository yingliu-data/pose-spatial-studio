import logging
from multiprocessing import process

import cv2
import numpy as np
import base64
from typing import Dict, Any, Tuple
from processors.mediapipe_processor import MediaPipeProcessor
from processors.rtmpose_processor import RTMPoseProcessor
from processors.image_processor import ImageProcessor
from processors.base_processor import BaseProcessor
from processors.data_processor import DataProcessor
from config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)

class WebSocketHandler:
    def __init__(self, sio):
        self.sio = sio
        self.processors: Dict[str, Dict[str, BaseProcessor]] = {}
        self.setup_handlers()
    
    def setup_handlers(self):
        @self.sio.event
        async def connect(sid, environ):
            logger.info(f"[CONN] Client connected: {sid}")
            logger.debug(f"[CONN] Total active processors: {len(self.processors)}")
            await self.sio.emit('connection_status', {'status': 'connected', 'sid': sid}, room=sid)
        
        @self.sio.event
        async def disconnect(sid):
            logger.info(f"[DISC] Client disconnected: {sid}")
            logger.debug(f"[DISC] Cleaning up processors for client {sid}")
            
            processors_to_cleanup = [pid for pid in self.processors.keys() if pid.startswith(f"{sid}_")]
            logger.debug(f"[DISC] Found {len(processors_to_cleanup)} processors to cleanup: {processors_to_cleanup}")
            for processor_id in processors_to_cleanup:
                self.cleanup_processor(processor_id)

        @self.sio.event
        async def initialize_stream(sid, data):
            try:
                stream_id = data.get('stream_id')
                processor_config = data.get('processor_config') or DEFAULT_CONFIG
                
                # Determine processor type from config
                pose_config = processor_config.get('pose_processor', {})
                processor_type = pose_config.get('processor_type', 'mediapipe')
                
                processor_id = f"{sid}_{stream_id}"

                logger.info(f"[INIT] Initializing stream {stream_id} for client {sid}")
                logger.debug(f"[INIT] Processor type: {processor_type}, config: {processor_config}")
                
                if processor_id in self.processors:
                    logger.warning(f"[INIT] Processor {processor_id} already exists")
                    await self.sio.emit('stream_initialized', {
                        'stream_id': stream_id,
                        'status': 'already_exists',
                        'message': 'Stream already initialized'
                    }, room=sid)
                    return

                # Notify frontend about loading status
                await self.sio.emit('stream_loading', {
                    'stream_id': stream_id,
                    'status': 'loading',
                    'message': f'Loading {processor_type} model...'
                }, room=sid)
                
                processor_pipeline= {}
                if processor_config.get('image_processor', {}):
                    processor_pipeline['image_processor'] = ImageProcessor(processor_id, processor_config)
                    logger.info(f"[INIT] Image processor created: {processor_id}")

                if processor_config.get('data_processor', {}):
                    processor_pipeline['date_processor'] = DataProcessor(processor_id, processor_config)
                    logger.info(f"[INIT] Data processor created: {processor_id}")

                if processor_config.get('pose_processor', {}):
                    if processor_type == 'mediapipe':
                        logger.info(f"[INIT] Creating MediaPipe processor")
                        processor_pipeline['pose_processor'] = MediaPipeProcessor(processor_id, processor_config)
                    elif processor_type == 'rtmpose':
                        logger.info(f"[INIT] Creating RTMpose processor")
                        processor_pipeline['pose_processor'] = RTMPoseProcessor(processor_id, processor_config)
                    else:
                        await self.sio.emit('stream_error', {
                            'stream_id': stream_id,
                            'message': f'Unknown processor type: {processor_type}. Use "mediapipe" or "rtmpose" in config model_name.'
                        }, room=sid)
                        return
                
                if not all([processor.initialize() for processor in processor_pipeline.values()]):
                    logger.error(f"[INIT] Processor initialization failed")
                    await self.sio.emit('stream_error', {
                        'stream_id': stream_id,
                        'message': 'Failed to initialize processor. Check config parameters.'
                    }, room=sid)
                    return
                
                self.processors[processor_id] = processor_pipeline
                logger.info(f"[INIT] ✓ Stream {stream_id} initialized successfully with {processor_type} (processor_id: {processor_id})")
                logger.debug(f"[INIT] Active processors: {list(self.processors.keys())}")
                logger.debug(f"[INIT] Processor pipeline: {self.processors.values()}")
                
                await self.sio.emit('stream_initialized', {
                    'stream_id': stream_id,
                    'status': 'success',
                    'message': 'Stream initialized successfully',
                    'processor_type': processor_type
                }, room=sid)
                
            except Exception as e:
                logger.error(f"Error initializing stream: {e}")
                await self.sio.emit('stream_error', {
                    'stream_id': data.get('stream_id'),
                    'message': f'Initialization error: {str(e)}'
                }, room=sid)
        
        @self.sio.event
        async def process_frame(sid, data):
            try:
                stream_id = data.get('stream_id')
                processor_id = f"{sid}_{stream_id}"
                timestamp = data.get('timestamp_ms', 0)
                
                if processor_id not in self.processors:
                    logger.warning(f"[ERROR] Processor {processor_id} not found")
                    await self.sio.emit('error', {
                        'message': 'Stream not initialized. Call initialize_stream first.'
                    }, room=sid)
                    return
                
                frame = self._decode_frame(data.get('frame'))
                if frame is None:
                    await self.sio.emit('error', {'message': 'Invalid frame data'}, room=sid)
                    return
                
                processor_pipeline = self.processors[processor_id]

                pose_data = None
                processed_frame = frame
                if 'image_processor' in processor_pipeline:
                    processed_frame = processor_pipeline['image_processor'].process_frame(processed_frame, timestamp)
                if 'date_processor' in processor_pipeline:
                    processed_frame = processor_pipeline['date_processor'].process_frame(processed_frame, timestamp)
                if 'pose_processor' in processor_pipeline:
                    result = processor_pipeline['pose_processor'].process_frame(processed_frame, timestamp)
                    processed_frame = None if result is None else result['processed_frame']
                    pose_data = None if result is None else result['data']
                if processed_frame is not None:
                    _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 100])
                    await self.sio.emit('pose_result', {
                        'stream_id': stream_id,
                        'frame': base64.b64encode(buffer).decode('utf-8'),
                        'pose_data': pose_data,
                        'timestamp_ms': timestamp
                    }, room=sid)
                
            except Exception as e:
                logger.error(f"Error processing frame: {e}", exc_info=True)
                await self.sio.emit('error', {'message': str(e)}, room=sid)
        
        @self.sio.event
        async def cleanup_processor(sid, data):
            stream_id = data.get('stream_id')
            processor_id = f"{sid}_{stream_id}"
            self.cleanup_processor(processor_id)
        
        @self.sio.event
        async def flush_stream(sid, data):
            try:
                stream_id = data.get('stream_id')
                processor_id = f"{sid}_{stream_id}"
                
                if processor_id in self.processors:
                    pipeline = self.processors[processor_id]
                    pose_processor = pipeline.get('pose_processor')
                    if pose_processor and hasattr(pose_processor, 'result_lock'):
                        with pose_processor.result_lock:
                            pose_processor.latest_pose_result = None
                            pose_processor.latest_object_result = None
                    
                    logger.info(f"[FLUSH] Stream {stream_id} flushed")
                    await self.sio.emit('stream_flushed', {'stream_id': stream_id}, room=sid)
                    
            except Exception as e:
                logger.error(f"[FLUSH] Error: {e}")
                await self.sio.emit('error', {'message': f'Flush error: {str(e)}'}, room=sid)
    
    def _decode_frame(self, frame_data: str) -> np.ndarray:
        try:
            if frame_data.startswith('data:image'):
                frame_data = frame_data.split(',')[1]
            img_bytes = base64.b64decode(frame_data)
            return cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
        except Exception as e:
            logger.error(f"Error decoding frame: {e}")
            return None
    
    def cleanup_processor(self, processor_id: str):
        if processor_id in self.processors:
            logger.debug(f"[CLEANUP] Cleaning up processor: {processor_id}")
            for processor in self.processors[processor_id]:
                self.processors[processor_id][processor].cleanup()
            del self.processors[processor_id]
            logger.info(f"[CLEANUP] ✓ Cleaned up processor: {processor_id}")
            logger.debug(f"[CLEANUP] Remaining processors: {list(self.processors.keys())}")
        else:
            logger.debug(f"[CLEANUP] Processor {processor_id} not found (already cleaned up?)")
    
    def cleanup_all(self):
        for processor_id in list(self.processors.keys()):
            self.cleanup_processor(processor_id)
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            "active_processors": len(self.processors),
            "processor_ids": list(self.processors.keys())
        }

