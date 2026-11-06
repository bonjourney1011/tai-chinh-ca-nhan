"""`taichinh demo` end to end through typer on a tiny synthetic history."""

import numpy as np
import pandas as pd
from typer.testing import CliRunner

from taichinh import cli
from taichinh.report import console_demo

runner = CliRunner()


def test_demo_smoke(monkeypatch):
    idx = pd.date_range("2018-01-31", periods=96, freq="ME")
    rng = np.random.default_rng(0)
    hist = pd.DataFrame(
        {"etf_vn30": rng.normal(0.01, 0.05, 96), "gold_sjc": rng.normal(0.008, 0.03, 96)},
        index=idx,
    )
    monkeypatch.setattr(console_demo, "monthly_returns_by_cma_key", lambda keys: hist)
    res = runner.invoke(
        cli.app, ["demo", "--target", "100000000", "--months", "36", "--profile", "can_bang"]
    )
    assert res.exit_code == 0, res.output
    assert "Cần gửi mỗi tháng" in res.output and "Vàng SJC" in res.output
