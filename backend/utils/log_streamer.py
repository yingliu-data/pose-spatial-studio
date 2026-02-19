import logging
import asyncio
from collections import deque


class SocketIOLogHandler(logging.Handler):
    """
    A logging.Handler that emits log records to a specific Socket.IO
    client session via a background async flush loop.
    """

    MAX_BUFFER_SIZE = 500
    FLUSH_INTERVAL_S = 0.15

    def __init__(self, sio, sid, level=logging.DEBUG, loop=None):
        super().__init__(level)
        self.sio = sio
        self.sid = sid
        self._loop = loop
        self._buffer = deque(maxlen=self.MAX_BUFFER_SIZE)
        self._running = True
        self.setFormatter(logging.Formatter('%(asctime)s', '%H:%M:%S'))
        # Start periodic flush loop on the event loop
        asyncio.run_coroutine_threadsafe(self._flush_loop(), self._loop)

    def emit(self, record):
        if not self._running:
            return
        try:
            log_entry = {
                'timestamp': self.format(record),
                'logger': record.name,
                'level': record.levelname,
                'message': record.getMessage(),
            }
            self._buffer.append(log_entry)
        except Exception:
            self.handleError(record)

    async def _flush_loop(self):
        """Periodically drain the buffer and emit to the client."""
        while self._running:
            await asyncio.sleep(self.FLUSH_INTERVAL_S)
            if not self._buffer:
                continue
            batch = []
            while self._buffer:
                try:
                    batch.append(self._buffer.popleft())
                except IndexError:
                    break
            if batch:
                try:
                    await self.sio.emit('log_batch', {'logs': batch}, room=self.sid)
                except Exception:
                    self._running = False

    def close(self):
        self._running = False
        super().close()
