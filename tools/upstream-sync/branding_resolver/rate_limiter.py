"""Thread-safe token-bucket rate limiter for API calls."""

from __future__ import annotations

import threading
import time


class RateLimiter:
    """Token-bucket rate limiter.

    Allows up to `requests_per_minute` requests, refilling tokens
    smoothly over time. Thread-safe via a lock.
    """

    def __init__(self, requests_per_minute: int = 50):
        self.rate = requests_per_minute / 60.0  # tokens per second
        self.max_tokens = float(requests_per_minute)
        self.tokens = float(requests_per_minute)
        self.last_refill = time.monotonic()
        self._lock = threading.Lock()

    def _refill(self) -> None:
        """Add tokens based on elapsed time since last refill."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.rate)
        self.last_refill = now

    def wait(self) -> None:
        """Block until a request slot is available, then consume one token."""
        while True:
            with self._lock:
                self._refill()
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return
                # Calculate how long to wait for one token
                wait_time = (1.0 - self.tokens) / self.rate

            time.sleep(wait_time)
