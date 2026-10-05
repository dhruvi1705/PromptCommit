import time
from collections import defaultdict, deque
from threading import Lock
from typing import Optional
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    """
    Lightweight, thread-safe in-memory sliding window rate limiter.
    Easily replaceable with Redis if scaled horizontally.
    """
    def __init__(self):
        self._records = defaultdict(deque)
        self._lock = Lock()

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        now = time.time()
        with self._lock:
            q = self._records[key]
            # Remove timestamps outside the sliding window
            while q and q[0] <= now - window_seconds:
                q.popleft()
            return len(q) >= max_requests

    def record_hit(self, key: str) -> None:
        now = time.time()
        with self._lock:
            self._records[key].append(now)

    def reset_key(self, key: str) -> None:
        with self._lock:
            if key in self._records:
                del self._records[key]

    def reset_all(self) -> None:
        with self._lock:
            self._records.clear()

limiter = InMemoryRateLimiter()

def check_login_rate_limit(request: Request) -> None:
    """Limit failed login attempts to 5 per IP per minute."""
    client_ip = limiter._get_client_ip(request)
    key = f"login_fail:{client_ip}"
    if limiter.is_rate_limited(key, max_requests=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later."
        )

def record_failed_login(request: Request) -> None:
    client_ip = limiter._get_client_ip(request)
    key = f"login_fail:{client_ip}"
    limiter.record_hit(key)

def record_successful_login(request: Request) -> None:
    client_ip = limiter._get_client_ip(request)
    key = f"login_fail:{client_ip}"
    limiter.reset_key(key)

def check_signup_rate_limit(request: Request) -> None:
    """Limit signups to 30 per IP per minute."""
    client_ip = limiter._get_client_ip(request)
    key = f"signup:{client_ip}"
    if limiter.is_rate_limited(key, max_requests=30, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup requests. Please try again later."
        )
    limiter.record_hit(key)

def check_ai_test_rate_limit(user_id_or_ip: str) -> None:
    """Limit AI test executions to 20 per user per minute."""
    key = f"ai_test:{user_id_or_ip}"
    if limiter.is_rate_limited(key, max_requests=20, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )
    limiter.record_hit(key)
