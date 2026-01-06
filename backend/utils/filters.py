import numpy as np

class MedianFilter:
    """
    Apply median filtering to streaming multidimensional data.
    Each channel/dimension is filtered independently.
    """
    def __init__(self, window_size=3):
        """
        Args:
            window_size (int): Size of the median filter window (must be odd).
            num_channels (int): Dimension of each data point (e.g., 3 for 3D).
        """
        if window_size % 2 == 0 or window_size < 1:
            raise ValueError("window_size must be a positive odd integer")
        self.window_size = window_size
        self.history = []

    def set_window_size(self, window_size):
        """Update the window size and reset the filter."""
        if window_size % 2 == 0 or window_size < 1:
            raise ValueError("window_size must be a positive odd integer")
        self.window_size = window_size
        self.reset()

    def reset(self):
        """Reset the filter history."""
        self.history = []

    def filter(self, value):
        """
        Add new value to the filter and return the filtered result.
        Args:
            value (array-like): New data array of shape (num_channels,)
        Returns:
            np.ndarray: Median-filtered value of shape (num_channels,)
        """
        arr = np.asarray(value)
        if arr.ndim != 1:
            self.num_channels = arr.shape[1]
        else:
            self.num_channels = arr.shape[0]

        self.history.append(arr.copy())
        if len(self.history) > self.window_size:
            self.history.pop(0)

        data = np.stack(self.history, axis=0)
        filtered = np.zeros(self.num_channels)
        for i in range(self.num_channels):
            # Always take the most recent window_size samples for this channel, pad with edge-value if not enough
            channel_data = data[:, i]
            n_missing = max(0, self.window_size - len(channel_data))
            if n_missing > 0:
                padded = np.pad(channel_data, (n_missing, 0), mode="edge")
            else:
                padded = channel_data[-self.window_size:]
            filtered[i] = np.median(padded)
        return filtered

