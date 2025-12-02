import logging
import sys
from pathlib import Path
from datetime import datetime
from utils.locate_path import get_project_root

def setup_project_logging(level: int = logging.INFO) -> logging.Logger:
    root_logger = logging.getLogger()
    if getattr(root_logger, "_project_logging_configured", False):
        return root_logger
    
    root_logger.setLevel(level)
    logs_dir = Path(get_project_root()) / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    log_file_path = logs_dir / f"{datetime.now().strftime('%Y-%m-%d')}.log"
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', '%Y-%m-%d %H:%M:%S')

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    file_handler = logging.FileHandler(str(log_file_path))
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    setattr(root_logger, "_project_logging_configured", True)
    return root_logger

