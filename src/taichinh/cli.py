"""Command-line entry point. Sub-commands are registered as phases land."""

from __future__ import annotations

from datetime import date

import typer

app = typer.Typer(help="taichinh — kế hoạch tài chính cá nhân theo mục tiêu", no_args_is_help=True)


@app.callback()
def _root() -> None:
    """taichinh CLI."""


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
        typer.echo(f"{name}: {'ok' if r['ok'] else 'FAIL'} rows={r['rows']} {tail}")


@app.command()
def fetch(
    source: str = typer.Option("all", help="stocks,gold,fx or all"),
    start: str = typer.Option(None, help="YYYY-MM-DD (default: last 30 days)"),
) -> None:
    """Fetch market data into data/market CSVs."""
    from taichinh.fetch import run_fetch

    res = run_fetch(_sources(source), date.fromisoformat(start) if start else None)
    _report(res)


@app.command()
def backfill(
    source: str = typer.Option("gold", help="gold (SJC 88-day windows, 2 s spacing)"),
    start: str = typer.Option("2016-01-01", help="YYYY-MM-DD"),
) -> None:
    """Backfill history for a source (windowed loop lives in the fetcher)."""
    from taichinh.fetch import run_fetch

    _report(run_fetch(_sources(source), date.fromisoformat(start)))


if __name__ == "__main__":
    app()


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
