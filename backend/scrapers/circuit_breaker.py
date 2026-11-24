"""
Per-Source Circuit Breaker & Health Telemetry for EquiLens 4-Layer Data Sources.

Sources monitored:
  - TRADINGVIEW
  - YAHOO_FINANCE
  - GOOGLE_FINANCE
  - SUPABASE_BEI

Rule: 3 consecutive failures -> OPEN circuit for 60 seconds -> automatic failover
without making the user wait for dead timeouts.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any

from quant_engine.utils import now_wib_iso

MANAGED_SOURCES = (
    "TRADINGVIEW",
    "YAHOO_FINANCE",
    "GOOGLE_FINANCE",
    "SUPABASE_BEI",
)


@dataclass
class SourceCircuitState:
    source: str
    failure_threshold: int = 3
    recovery_timeout_sec: float = 60.0
    state: str = "CLOSED"  # CLOSED | OPEN | HALF_OPEN
    consecutive_failures: int = 0
    total_requests: int = 0
    total_failures: int = 0
    last_latency_ms: float = 0.0
    avg_latency_ms: float = 0.0
    last_error: str | None = None
    last_success_at: str | None = None
    opened_until_mono: float = 0.0
    _latencies: list[float] = field(default_factory=list, repr=False)


class CircuitBreakerRegistry:
    """Thread-safe registry tracking circuit state and latency for all 4 data providers."""

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout_sec: float = 60.0,
    ) -> None:
        self._lock = threading.Lock()
        self._threshold = failure_threshold
        self._recovery = recovery_timeout_sec
        self._circuits: dict[str, SourceCircuitState] = {
            src: SourceCircuitState(
                source=src,
                failure_threshold=failure_threshold,
                recovery_timeout_sec=recovery_timeout_sec,
            )
            for src in MANAGED_SOURCES
        }

    def _get(self, source: str) -> SourceCircuitState:
        key = source.upper()
        if key not in self._circuits:
            self._circuits[key] = SourceCircuitState(
                source=key,
                failure_threshold=self._threshold,
                recovery_timeout_sec=self._recovery,
            )
        return self._circuits[key]

    def can_execute(self, source: str) -> bool:
        now = time.monotonic()
        with self._lock:
            cb = self._get(source)
            if cb.state == "CLOSED":
                return True
            if cb.state == "OPEN":
                if now >= cb.opened_until_mono:
                    cb.state = "HALF_OPEN"
                    return True
                return False
            # HALF_OPEN allows a single probe
            return True

    def record_success(self, source: str, latency_ms: float = 0.0) -> None:
        with self._lock:
            cb = self._get(source)
            cb.state = "CLOSED"
            cb.consecutive_failures = 0
            cb.total_requests += 1
            cb.last_error = None
            cb.last_success_at = now_wib_iso()
            cb.last_latency_ms = round(max(0.0, latency_ms), 1)
            cb._latencies.append(cb.last_latency_ms)
            if len(cb._latencies) > 25:
                cb._latencies = cb._latencies[-25:]
            cb.avg_latency_ms = round(
                sum(cb._latencies) / len(cb._latencies), 1
            )

    def record_failure(
        self,
        source: str,
        error: str,
        latency_ms: float = 0.0,
    ) -> None:
        now = time.monotonic()
        with self._lock:
            cb = self._get(source)
            cb.total_requests += 1
            cb.total_failures += 1
            cb.consecutive_failures += 1
            cb.last_error = str(error)[:240]
            cb.last_latency_ms = round(max(0.0, latency_ms), 1)
            if cb.consecutive_failures >= cb.failure_threshold:
                cb.state = "OPEN"
                cb.opened_until_mono = now + cb.recovery_timeout_sec

    def is_open(self, source: str) -> bool:
        return not self.can_execute(source)

    def get_source_status(self, source: str) -> dict[str, Any]:
        now = time.monotonic()
        with self._lock:
            cb = self._get(source)
            cooldown_remaining = (
                round(max(0.0, cb.opened_until_mono - now), 1)
                if cb.state == "OPEN"
                else 0.0
            )
            return {
                "source": cb.source,
                "state": cb.state,
                "healthy": cb.state != "OPEN",
                "consecutive_failures": cb.consecutive_failures,
                "total_requests": cb.total_requests,
                "total_failures": cb.total_failures,
                "last_latency_ms": cb.last_latency_ms,
                "avg_latency_ms": cb.avg_latency_ms,
                "cooldown_remaining_sec": cooldown_remaining,
                "last_success_at": cb.last_success_at,
                "last_error": cb.last_error,
            }

    def get_all_status(self) -> dict[str, dict[str, Any]]:
        return {src: self.get_source_status(src) for src in MANAGED_SOURCES}

    def reset(self, source: str | None = None) -> None:
        with self._lock:
            targets = [source.upper()] if source else list(self._circuits.keys())
            for key in targets:
                self._circuits[key] = SourceCircuitState(
                    source=key,
                    failure_threshold=self._threshold,
                    recovery_timeout_sec=self._recovery,
                )


# Shared singleton circuit breaker across all scrapers and API endpoints
circuit_breaker = CircuitBreakerRegistry(
    failure_threshold=3,
    recovery_timeout_sec=60.0,
)
