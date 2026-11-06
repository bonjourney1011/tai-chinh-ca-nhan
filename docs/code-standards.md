# Code standards

- Python 3.13, managed by `uv`. Run `uv run ruff check --fix` and `uv run pytest -q` before every commit.
- Files under 200 lines. Names describe purpose (`vndirect_stocks.py`, `goal-wizard-form-spec.js`).
- Rates are annual decimals at every public boundary; convert to monthly with `(1+R)**(1/12)-1` inside.
- Every stochastic function takes `seed` and uses `np.random.default_rng(seed)`; no global RNG state.
- Engine modules are pure (no I/O). Only `cma.py` reads YAML; only `sheets/` talks to Google; only `fetch/` talks to the internet.
- Fetchers: pure `parse_*(raw)` tested on fixtures + network `fetch_*`; generic User-Agent; robots.txt Disallow is a hard stop; never log response bodies.
- Sheet tabs: one writer per tab; columns matched by position; new columns only at the end; text columns formatted `@`.
- Apps Script: planners are pure functions returning `{appends, updates}`; only `sheet-repository.gs` touches SpreadsheetApp; every handler goes through `respondJson_`.
- Web: no framework, ES modules, `textContent` only (never `innerHTML`), CDN scripts pinned with SRI, CSP meta present.
- Vietnamese UI text: short SVO sentences, no finance jargon ("chia tiền", not "allocation").
- Commits: conventional (`feat:`, `fix:`, `data:`, `docs:`, `chore:`), no AI references.
