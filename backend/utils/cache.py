from functools import wraps
from pathlib import Path
from datetime import datetime, timedelta
import json
import hashlib

def cache_to_file(cache_dir=".cache", ttl_days=7):
    cache_path = Path(cache_dir)
    cache_path.mkdir(exist_ok=True, parents=True)
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = hashlib.md5(f"{func.__name__}:{args}:{sorted(kwargs.items())}".encode()).hexdigest()
            data_file = cache_path / f"{cache_key}.json"
            meta_file = cache_path / f"{cache_key}.meta"
            
            if data_file.exists() and meta_file.exists():
                with open(meta_file) as f:
                    if datetime.now() - datetime.fromisoformat(json.load(f)['timestamp']) < timedelta(days=ttl_days):
                        with open(data_file) as f:
                            return json.load(f)
            
            result = func(*args, **kwargs)
            if result:
                with open(data_file, 'w') as f:
                    json.dump(result, f, indent=2)
                with open(meta_file, 'w') as f:
                    json.dump({'timestamp': datetime.now().isoformat(), 'function': func.__name__}, f)
            return result
        return wrapper
    return decorator
