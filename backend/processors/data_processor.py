from typing import Dict, Any, Optional
import numpy as np
from collections import deque
import config
from processors.base_processor import BaseProcessor
import cv2
import logging
logger = logging.getLogger(__name__)

class DataProcessor(BaseProcessor):
    
    def __init__(self, processor_id: str, config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        self.processor_id = processor_id

        self.config = config.merge_configs(config_dict)['data_processor']
        logger.debug(f"[DATA] Data processor config: {self.config}")
        
        self.last_processed_time: float = 0.0
        
        self.window_size = self.config['window_size'] if self.config['window_size'] > 0 else 1
        self.frame_differencing_enabled = self.config['frame_differencing_enabled']
        self.preprocessing_mode = self.config['preprocessing_mode']
        self.greyscale_enabled = self.config['greyscale_enabled']
       
        self.frame_buffer: deque = deque[np.ndarray | None](maxlen=self.window_size)
        self.timestamp_buffer: deque = deque[float](maxlen=self.window_size)

        self.anchor_frame: np.ndarray = None
        
    def initialize(self) -> bool:
        self._is_initialized = True
        logger.info(f"[INIT] Data processor {self.processor_id} initialized")
        return True

    def process_frame(
        self, 
        frame: np.ndarray, 
        timestamp: float,
    ) -> Optional[np.ndarray]:
    
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")            

        if frame is None or np.isnan(frame).any():
            return None

        if not self._fps_throttling(timestamp, self.config['target_fps']):
            return None
        self.last_processed_time = timestamp

        if self.greyscale_enabled:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        self.timestamp_buffer.append(timestamp)
        self.frame_buffer.append(frame)
        
        if self._is_ready():
            return self.get_output()
        return None
    
    def get_output(self) -> np.ndarray:

        if self.preprocessing_mode == "sliding_window":
            if self.frame_differencing_enabled:
                output = np.array(self.frame_buffer) - np.array(self.frame_buffer[0])
            else:
                output = np.array(self.frame_buffer)

        if self.preprocessing_mode == "single_frame":
            if self.frame_differencing_enabled:
                output = self.frame_buffer[-1] - self.frame_buffer[0]
            else:
                output = self.frame_buffer[-1]
        
        return output
    
    def _is_ready(self) -> bool:
        if self.preprocessing_mode == "sliding_window":
            return len(self.frame_buffer) == self.window_size and not np.isnan(self.frame_buffer[0]).any()
        if self.preprocessing_mode == "single_frame":
            return len(self.frame_buffer) >= 1 and not np.isnan(self.frame_buffer[0]).any()
        return False

    def cleanup(self):
        self.frame_buffer.clear()
        self.timestamp_buffer.clear()
        self.last_processed_time = 0.0
    
    def _fps_throttling(self, timestamp: float, target_fps: int) -> bool:
        return timestamp - self.last_processed_time >= 1.0 / target_fps
    
    def _apply_frame_differencing(self) -> np.ndarray:  
        if self.anchor_frame is not None:
            self.frame_buffer += self.anchor_frame - self.frame_buffer[0]


if __name__ == "__main__":
    import Pathlib
    recording_folder =  Pathlib.PaTH("/Users/yingliu/Documents/Kotlin_Projects/Label_Software_Production/recordings/")
