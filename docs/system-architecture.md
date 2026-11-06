# System architecture

Three parts, one Google Sheet in the middle. Each Sheet tab has exactly one writer.

```
GitHub Actions (monthly cron + manual) ── uv run taichinh run-monthly
  fetch   → data/market/*.csv   (VNDirect, SJC/BTMC, Vietcombank, World Bank, Tiingo, Kraken; committed)
  pull-manual ← Sheet.Manual_Prices (fund NAV, deposit rates, bond yields)
  compute → engine (CMA → equity caps → min-var/ERC → PMT → Monte Carlo → budget → tracking)
  push    → Sheet result tabs: Assets, Prices_Latest, Plan, Tracking, Run_Log

Phone/laptop → web/ (GitHub Pages, static ES modules) → Apps Script doPost {t, action, data, requestId}
  Apps Script writes input tabs: Config, Goals, Budget, Contributions, Holdings, Manual_Prices, Snapshot
```

## Layers (Python package `src/taichinh`)

| Layer | Folder | Responsibility |
|---|---|---|
| fetch | `fetch/` | one module per external source; pure `parse_*` + network `fetch_*`; never raises into the pipeline |
| store | `store/` | CSV contracts (`schemas.py`), idempotent upsert, loaders that return VND close series |
| sheets | `sheets/` | gspread client, tab/header contract (`tabs.py`, mirrored by `apps-script/domain-constants.gs`), read inputs, replace result tabs |
| engine | `engine/` | pure numerics: returns, covariance, Markowitz (ported from the founder's TS engine), goal math, Monte Carlo, allocation rules, budget rules, tracking |
| report | `report/` | engine results → Sheet rows / console |
| cli | `cli.py` | `fetch`, `backfill`, `pull-manual`, `compute`, `push`, `run-monthly`, `demo` |

## Contracts
- `store/schemas.py` — CSV columns + upsert keys.
- `sheets/tabs.py` — tab names + header order (positional; append-only).
- `engine/types.py` — dataclasses shared across engine, report and CLI.
- Apps Script API: POST text/plain JSON `{t, action, data, requestId}` → `{ok, ...}`; see `apps-script/README` section in the root README.

## Privacy
Repo is public. Personal numbers live only in the Sheet behind the Apps Script token. Secrets (`SHEET_ID`, service-account JSON, Tiingo token) exist only in `.env` (gitignored) and GitHub Secrets.
