"""robots.txt policy, partial fetch results and status reporting (no network)."""

from __future__ import annotations

import json
from datetime import date

import pandas as pd
import pytest
import requests

from taichinh import fetch, settings
from taichinh.fetch import http_client, sjc_gold
from taichinh.store.schemas import GOLD_DAILY, STOCKS_DAILY


class _Resp:
    def __init__(self, status=200, text="", ctype="text/plain", payload=None):
        self.status_code, self.text, self.headers = status, text, {"content-type": ctype}
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}", response=self)


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    monkeypatch.setattr(http_client, "_robots", {})
    monkeypatch.setattr(http_client, "min_interval", lambda *_: None)
    monkeypatch.setattr(http_client.time, "sleep", lambda *_: None)


def _serve(monkeypatch, robots: _Resp, api: _Resp | None = None):
    calls = []

    def get(url, **kw):
        if url.endswith("/robots.txt"):
            if isinstance(robots, Exception):
                raise robots
            return robots
        calls.append(url)
        return api

    monkeypatch.setattr(http_client._session, "get", get)
    monkeypatch.setattr(http_client._session, "request", lambda m, url, **kw: get(url, **kw))
    return calls


def test_robots_disallow_raises(monkeypatch):
    calls = _serve(monkeypatch, _Resp(text="User-agent: *\nDisallow: /api/"))
    with pytest.raises(http_client.RobotsDisallowed):
        http_client.get_json("https://example.test/api/x")
    assert calls == []


def test_robots_5xx_and_unreachable_disallow_4xx_allows(monkeypatch):
    _serve(monkeypatch, _Resp(status=503))
    assert http_client.robots_allows("https://a.test/x") is False
    http_client._robots.clear()
    _serve(monkeypatch, requests.ConnectionError("down"))
    assert http_client.robots_allows("https://b.test/x") is False
    http_client._robots.clear()
    _serve(monkeypatch, _Resp(status=404))
    assert http_client.robots_allows("https://c.test/x") is True


def test_plain_4xx_is_not_retried(monkeypatch):
    calls = _serve(monkeypatch, _Resp(status=404), _Resp(status=400))
    with pytest.raises(RuntimeError, match="HTTP 400"):
        http_client.get_json("https://d.test/x")
    assert len(calls) == 1


def test_5xx_is_retried(monkeypatch):
    calls = _serve(monkeypatch, _Resp(status=404), _Resp(status=502))
    with pytest.raises(RuntimeError, match="failed after"):
        http_client.get_json("https://e.test/x")
    assert len(calls) == http_client.RETRIES


def _gold_df(day="2026-11-05"):
    return pd.DataFrame([[day, "SJC_1L", 1.0, 2.0, "sjc", "t"]], columns=list(GOLD_DAILY.columns))


def test_run_fetch_partial_failure_still_upserts_and_writes_status(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "DATA_DIR", tmp_path)

    def boom(*_):
        raise RuntimeError("stocks down")

    monkeypatch.setitem(fetch.FETCHERS, "stocks", boom)
    monkeypatch.setitem(fetch.FETCHERS, "gold", lambda s, e: _gold_df())
    res = fetch.run_fetch(["stocks", "gold"], date(2026, 11, 1), date(2026, 11, 6))
    assert res["stocks"]["ok"] is False and "stocks down" in res["stocks"]["error"]
    assert res["gold"]["ok"] is True and res["gold"]["rows"] == 1
    assert (tmp_path / GOLD_DAILY.file).exists() and not (tmp_path / STOCKS_DAILY.file).exists()
    status = json.loads((tmp_path / "_fetch_status.json").read_text(encoding="utf-8"))
    assert status["gold"]["ok"] and not status["stocks"]["ok"]


def test_sjc_partial_windows_kept_and_error_exposed(monkeypatch):
    def post(url, data, spacing=1.0):
        if data["method"] == "GetGoldPrice":
            return {"latestDate": "", "data": []}
        if data["fromDate"].startswith("0") and data["goldPriceId"] == 1:
            return {"success": True, "data": [
                {"Id": 1, "GroupDate": "/Date(1762300800000)/", "BuyValue": 1, "SellValue": 2}]}
        raise RuntimeError("window failed")

    monkeypatch.setattr(http_client, "post_form", post)
    monkeypatch.setattr(sjc_gold, "windows", lambda s, e, n: [(date(2026, 1, 1), date(2026, 3, 1)),
                                                              (date(2026, 3, 2), date(2026, 5, 1))])
    df = sjc_gold.fetch_sjc(date(2026, 1, 1), date(2026, 5, 1))
    assert len(df) == 1 and "window failed" in df.attrs["error"]


def test_gold_status_shows_sjc_error_when_btmc_fallback_used(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "DATA_DIR", tmp_path)

    def sjc_down(*_):
        raise RuntimeError("sjc blocked")

    monkeypatch.setattr(fetch, "fetch_sjc", sjc_down)
    monkeypatch.setattr(fetch, "fetch_btmc", lambda s, e: _gold_df())
    monkeypatch.setitem(fetch.FETCHERS, "gold", fetch.fetch_gold)
    res = fetch.run_fetch(["gold"], date(2026, 11, 1), date(2026, 11, 6))["gold"]
    assert res["ok"] is True and res["fallback"] == "btmc" and "sjc blocked" in res["error"]
