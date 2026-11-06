"""Shared fixtures: build MarketInputs from the golden price fixtures (column 0 = VN-Index)."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from taichinh.engine.returns import TRADING_DAYS, simple_returns
from taichinh.engine.types import MarketInputs

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / f"{name}-prices.json").read_text(encoding="utf-8"))


def fixture_returns(name: str) -> np.ndarray:
    """Simple daily returns, shape [asset, day]."""
    return simple_returns(np.array(load_fixture(name)["closes"], dtype=float))


def market_inputs(name: str, assets: list[int], rf: float) -> MarketInputs:
    r = fixture_returns(name)[assets]
    return MarketInputs(r.mean(axis=1) * TRADING_DAYS, np.cov(r, ddof=1) * TRADING_DAYS, rf)


@pytest.fixture
def exam_returns() -> np.ndarray:
    return fixture_returns("exam-bsr-hdb-vic")


@pytest.fixture
def exam_inputs():
    return lambda assets, rf: market_inputs("exam-bsr-hdb-vic", assets, rf)


@pytest.fixture
def template_inputs():
    return lambda assets, rf: market_inputs("template-vcb-vhm-vnm", assets, rf)
