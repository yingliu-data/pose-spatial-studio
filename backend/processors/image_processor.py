from typing import Dict, Any, Optional
import numpy as np
import logging
from processors.base_processor import BaseProcessor

logger = logging.getLogger(__name__)

class ImageProcessor(BaseProcessor):
    def __init__(self, processor_id: str, config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        self.processor_id = processor_id

    def initialize(self) -> bool:
        self._is_initialized = True
        logger.info(f"Image processor {self.processor_id} initialized")
        return True

    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> np.ndarray:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")
        return np.fliplr(frame)
    
    def cleanup(self):
        self._is_initialized = False
        logger.info(f"Image processor {self.processor_id} cleaned up")