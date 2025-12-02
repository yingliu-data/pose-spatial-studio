from pathlib import Path
import os
from typing import Union, List, Optional

def get_project_root(marker_file: Optional[str] = None, marker_dirs: Optional[List[str]] = None) -> Path:
    """
    Find project root by searching for marker files or directories.
    
    Args:
        marker_file: Optional filename to search for (e.g., 'pyproject.toml', '.git')
        marker_dirs: Optional list of directory names that indicate project root
    
    Returns:
        Path to project root, defaults to current working directory if not found
    """
    current_path = Path(__file__).resolve().parent
    
    # Default markers
    if marker_file is None and marker_dirs is None:
        marker_dirs = ["Frontend", "Backend"]  # Your specific project structure
        marker_file = "pyproject.toml"
    
    try:
        for _ in range(10):  # Limit upward traversal
            # Check for marker file
            if marker_file and (current_path / marker_file).exists():
                return current_path
            
            # Check for marker directories
            if marker_dirs:
                if all((current_path / d).exists() for d in marker_dirs):
                    return current_path
            
            # Move up one level
            parent = current_path.parent
            if parent == current_path:  # Reached filesystem root
                break
            current_path = parent
            
    except Exception as e:
        print(f"Error in get_project_root: {str(e)}")
        return Path.cwd()
    
    return Path.cwd()

def get_output_path(subfolder: Optional[str] = None) -> str:
    """Get or create output directory path."""
    output_dir = get_project_root() / "output"
    output_dir.mkdir(exist_ok=True)
    
    if subfolder is None:
        return str(output_dir)
    else:
        subfolder_path = output_dir / subfolder
        subfolder_path.mkdir(exist_ok=True, parents=True)
        return str(subfolder_path)

def search_files(path: Union[str, List[str]], ext: str = ".mp4") -> List[str]:
    """Search for files with specified extension in given path(s)."""
    paths = [path] if isinstance(path, str) else path
    all_files = []
    
    for single_path in paths:
        if not os.path.exists(single_path):
            print(f"Warning: Path does not exist: {single_path}")
            continue
        
        if os.path.isfile(single_path):
            if ext is None or single_path.endswith(ext):
                all_files.append(single_path)
        else:
            for root, dirs, filenames in os.walk(single_path):
                for filename in filenames:
                    if ext is None or filename.endswith(ext):
                        all_files.append(os.path.join(root, filename))
    
    return all_files
