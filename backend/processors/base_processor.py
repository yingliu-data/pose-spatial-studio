from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import numpy as np
import config as app_config

class BaseProcessor(ABC):
    def __init__(self, processor_id: str, config: Optional[Dict[str, Any]] = None):
        self.processor_id = processor_id
        self.config = app_config.merge_configs(config)
        self._is_initialized = False
    
    @abstractmethod
    def initialize(self) -> bool:
        pass
    
    @abstractmethod
    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def cleanup(self):
        pass
    
    @property
    def is_initialized(self) -> bool:
        return self._is_initialized

