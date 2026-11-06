"""Environment and config-file loading. No secrets are ever logged or committed."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import yaml
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = REPO_ROOT / "config"
DATA_DIR = REPO_ROOT / "data" / "market"


def load_yaml(name: str) -> dict:
    with (CONFIG_DIR / name).open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@dataclass(frozen=True)
class Settings:
    sheet_id: str
    sa_info: dict | None
    tiingo_token: str
    tz: str

    @property
    def has_sheet(self) -> bool:
        return bool(self.sheet_id and self.sa_info)


def _service_account_info() -> dict | None:
    raw = os.getenv("GSPREAD_SA_JSON", "").strip()
    if raw:
        return json.loads(raw)
    path = os.getenv("GSPREAD_SA_FILE", "").strip()
    if path and Path(path).is_file():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return None


def load_settings() -> Settings:
    load_dotenv(REPO_ROOT / ".env")
    return Settings(
        sheet_id=os.getenv("SHEET_ID", "").strip(),
        sa_info=_service_account_info(),
        tiingo_token=os.getenv("TIINGO_TOKEN", "").strip(),
        tz=os.getenv("TAICHINH_TZ", "Asia/Ho_Chi_Minh"),
    )
