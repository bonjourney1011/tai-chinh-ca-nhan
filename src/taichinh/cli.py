"""Command-line entry point. Sub-commands are registered as phases land."""

from __future__ import annotations

import sys
from datetime import date, timedelta

import typer

from taichinh.cli_helpers import _compute, _load_inputs, _pull_manual, _push, _trigger

DEFAULT_START_DAYS = 60  # fetch / run-monthly look-back when --start is not given

app = typer.Typer(help="taichinh — kế hoạch tài chính cá nhân theo mục tiêu", no_args_is_help=True)


@app.callback()
def _root() -> None:
    """taichinh CLI."""
    for stream in (sys.stdout, sys.stderr):  # Vietnamese text must survive pipes on Windows
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass


@app.command()
def version() -> None:
    """Print the package version."""
    from taichinh import __version__

    typer.echo(__version__)


def _sources(value: str) -> list[str]:
    from taichinh.fetch import FETCHERS

    names = list(FETCHERS) if value.strip() == "all" else [s.strip() for s in value.split(",")]
    bad = [n for n in names if n not in FETCHERS]
    if bad:
        raise typer.BadParameter(f"unknown source(s): {','.join(bad)}; use {','.join(FETCHERS)}")
    return names


def _report(res: dict[str, dict]) -> None:
    for name, r in res.items():
        tail = f"latest={r['latest']}" if r["ok"] else f"error={r['error']}"
        if r["ok"] and r.get("error"):  # e.g. SJC failed but BTMC fallback worked
            tail += f" fallback={r.get('fallback')} error={r['error']}"
        typer.echo(f"{name}: {'ok' if r['ok'] else 'FAIL'} rows={r['rows']} {tail}")


def _start_date(start: str | None) -> date:
    return date.fromisoformat(start) if start else date.today() - timedelta(DEFAULT_START_DAYS)


@app.command()
def fetch(
    source: str = typer.Option("all", help="stocks,gold,fx,crypto or all"),
    start: str = typer.Option(None, help="YYYY-MM-DD (default: last 60 days)"),
) -> None:
    """Fetch market data into data/market CSVs."""
    from taichinh.fetch import run_fetch

    res = run_fetch(_sources(source), _start_date(start))
    _report(res)


@app.command()
def backfill(
    source: str = typer.Option("gold", help="gold (SJC 88-day windows, 2 s spacing)"),
    start: str = typer.Option("2016-01-01", help="YYYY-MM-DD"),
) -> None:
    """Backfill history for a source (windowed loop lives in the fetcher)."""
    from taichinh.fetch import run_fetch

    _report(run_fetch(_sources(source), date.fromisoformat(start)))


@app.command()
def demo(
    target: float = typer.Option(100_000_000, help="Số tiền mục tiêu (VND)"),
    months: int = typer.Option(36, help="Kỳ hạn (tháng)"),
    profile: str = typer.Option("can_bang", help="bao_thu | can_bang | tang_truong"),
    pv: float = typer.Option(0.0, help="Tiền có sẵn (VND)"),
    foreign: bool = typer.Option(False, help="Thêm ETF Mỹ + BTC"),
    scenario: str = typer.Option("base", help="low | base | high"),
) -> None:
    """Lập kế hoạch một mục tiêu từ dữ liệu CSV thật và in ra màn hình."""
    from taichinh.report.console_demo import build_plan, render

    plan, hist_months = build_plan(target, months, profile, pv, foreign, scenario)
    typer.echo(render(plan, hist_months))


@app.command("pull-manual")
def pull_manual(
    inputs_json: str = typer.Option(None, help="Fixture JSON thay cho Sheet (để thử cục bộ)"),
) -> None:
    """Đọc Manual_Prices và ghi vào CSV tháng (lãi suất, NAV, lợi suất trái phiếu)."""
    inputs, _ = _load_inputs(inputs_json)
    counts = _pull_manual(inputs)
    for name, n in counts.items():
        typer.echo(f"{name}: +{n} rows")
    if not counts:
        typer.echo("manual prices: nothing to upsert")


@app.command("compute")
def compute_cmd(
    dry_run: bool = typer.Option(True, "--dry-run/--no-dry-run", help="Chỉ tính, không ghi Sheet"),
    inputs_json: str = typer.Option(None, help="Fixture JSON thay cho Sheet (để thử cục bộ)"),
) -> None:
    """Tính kế hoạch/theo dõi và in số dòng kết quả (không ghi Sheet)."""
    inputs, _ = _load_inputs(inputs_json)
    res = _compute(inputs)
    typer.echo(f"plan={len(res.plan_rows)} tracking={len(res.tracking_rows)} "
               f"prices={len(res.prices_rows)} assets={len(res.assets_rows)} "
               f"warnings={len(res.warnings)}")
    if res.plan_rows:
        r = res.plan_rows[0]
        typer.echo(f"{r[0]}/{r[1]}: pmt={r[2]:,}/month p_success={r[4]:.0%} end_base={r[6]:,}")


@app.command("push")
def push() -> None:
    """Tính lại và ghi các tab kết quả + Run_Log lên Sheet."""
    inputs, sh = _load_inputs(None)
    res = _compute(inputs)
    n = _push(sh, res, _trigger(), "", "", "ok", f"warnings={len(res.warnings)}")
    typer.echo(f"pushed rows={n}")


@app.command("run-monthly")
def run_monthly(
    sources: str = typer.Option("all", help="stocks,gold,fx,crypto or all"),
    start: str = typer.Option(None, help="YYYY-MM-DD (default: last 60 days)"),
    push_sheet: bool = typer.Option(True, "--push/--no-push"),
    inputs_json: str = typer.Option(None, help="Fixture JSON thay cho Sheet (để thử cục bộ)"),
) -> None:
    """fetch -> pull-manual -> compute -> push -> Run_Log. Mỗi bước tách riêng."""
    from taichinh.fetch import run_fetch

    ok, failed = [], []
    try:
        res_f = run_fetch(_sources(sources), _start_date(start))
        _report(res_f)
        ok = [k for k, v in res_f.items() if v["ok"]]
        failed = [k for k, v in res_f.items() if not v["ok"]]
    except Exception as e:  # noqa: BLE001 - fetch stage must not stop the run
        failed.append(f"fetch:{type(e).__name__}")
        typer.echo(f"fetch stage failed: {type(e).__name__}")
    try:
        inputs, sh = _load_inputs(inputs_json)
    except Exception as e:  # noqa: BLE001
        typer.echo(f"read inputs failed: {type(e).__name__}")
        raise typer.Exit(1) from None
    try:
        counts = _pull_manual(inputs)
        typer.echo(f"manual: {counts}")
    except Exception as e:  # noqa: BLE001
        failed.append(f"manual:{type(e).__name__}")
        typer.echo(f"pull-manual failed: {type(e).__name__}")
    try:
        res = _compute(inputs)
        typer.echo(f"computed plan={len(res.plan_rows)} tracking={len(res.tracking_rows)}")
        if push_sheet and sh is not None:
            n = _push(sh, res, _trigger(), ",".join(ok), ",".join(failed),
                      "partial" if failed else "ok", f"warnings={len(res.warnings)}")
            typer.echo(f"pushed rows={n}")
    except Exception as e:  # noqa: BLE001
        typer.echo(f"compute/push failed: {type(e).__name__}")
        raise typer.Exit(1) from None


if __name__ == "__main__":
    app()
