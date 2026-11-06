"""Command-line entry point. Sub-commands are registered as phases land."""

from __future__ import annotations

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


if __name__ == "__main__":
    app()
