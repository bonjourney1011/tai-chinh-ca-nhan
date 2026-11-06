"""Thin gspread wrapper. Columns are matched BY POSITION against tabs.HEADERS. Never logs cells."""

from __future__ import annotations

import time

import gspread
from gspread.exceptions import APIError, WorksheetNotFound

from taichinh.settings import Settings
from taichinh.sheets.tabs import HEADERS

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
MAX_RETRIES = 5


def open_sheet(settings: Settings) -> gspread.Spreadsheet:
    if not settings.has_sheet:
        raise RuntimeError("Chưa cấu hình SHEET_ID / GSPREAD_SA_JSON (hoặc GSPREAD_SA_FILE)")
    gc = gspread.service_account_from_dict(settings.sa_info, scopes=SCOPES)
    return gc.open_by_key(settings.sheet_id)


def _with_retry(fn, *args, **kwargs):
    delay = 2.0
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except APIError as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            if code not in (429, 500, 502, 503) or attempt == MAX_RETRIES - 1:
                raise
            time.sleep(delay)
            delay *= 2


def _worksheet(sh: gspread.Spreadsheet, name: str, create: bool):
    try:
        return sh.worksheet(name)
    except WorksheetNotFound:
        if not create:
            return None
        return sh.add_worksheet(title=name, rows=200, cols=len(HEADERS[name]))


def read_tab(sh: gspread.Spreadsheet, name: str) -> list[dict]:
    """Rows as dicts keyed by tabs.HEADERS[name] by position; missing tab -> []."""
    ws = _worksheet(sh, name, create=False)
    if ws is None:
        return []
    values = _with_retry(ws.get_all_values)
    cols = HEADERS[name]
    out = []
    for row in values[1:]:
        if not any(str(c).strip() for c in row):
            continue
        cells = list(row[: len(cols)]) + [""] * max(len(cols) - len(row), 0)
        out.append(dict(zip(cols, cells, strict=True)))
    return out


def replace_tab(sh: gspread.Spreadsheet, name: str, rows: list[list]) -> int:
    """Clear the tab, then write header + rows in a single update. Returns data rows written."""
    header = list(HEADERS[name])
    for r in rows:
        if len(r) != len(header):
            raise ValueError(f"{name}: row has {len(r)} cells, expected {len(header)}")
    ws = _worksheet(sh, name, create=True)
    _with_retry(ws.clear)
    _with_retry(ws.update, values=[header, *rows], range_name="A1", raw=False)
    return len(rows)


def append_row(sh: gspread.Spreadsheet, name: str, row: list) -> None:
    """Append one row (RAW) to a log tab, writing the header if the tab is new/empty."""
    ws = _worksheet(sh, name, create=True)
    if not _with_retry(ws.get_values, "A1:A1"):
        _with_retry(ws.update, values=[list(HEADERS[name])], range_name="A1")
    _with_retry(ws.append_row, row, value_input_option="RAW")
