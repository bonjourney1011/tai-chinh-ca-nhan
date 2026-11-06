"""Shared helpers for fetchers."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta


def now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def windows(start: date, end: date, max_days: int):
    """Yield consecutive inclusive (from, to) date windows of at most `max_days` days."""
    cur = start
    while cur <= end:
        to = min(cur + timedelta(days=max_days - 1), end)
        yield cur, to
        cur = to + timedelta(days=1)
