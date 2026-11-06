# Data sources (verified 2026-11-05/06)

Runner note (06/11/2026): GitHub-hosted runners (US IP) get SJC and BTMC blocked, while a PC in Vietnam gets `portal.vietcombank.com.vn/robots.txt` 504. Gold therefore refreshes from the founder's PC; fx and crypto from Actions.

All requests use UA `taichinh-bot/0.1 (personal finance research)`, no personal info, one request
at a time, robots.txt `Disallow` is a hard stop (`http_client.robots_allows`).

| Source | Endpoint | Unit -> stored | Cadence | robots / ToS | Fallback |
|---|---|---|---|---|---|
| VNDirect dchart (`stocks_daily`) | `GET https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=<S>&from=<unix>&to=<unix>` (UDF JSON) | nghin dong -> x1000 VND (stocks/ETF); VNINDEX = points, not scaled | daily after close | no robots.txt (404); windows <= 5 years; E1VFVN30 from 2014-10, VNINDEX from 2017-08 | none yet |
| SJC (`gold_daily`) | `POST https://sjc.com.vn/GoldPrice/Services/PriceService.ashx` body `method=GetGoldPrice` (current) / `method=GetGoldPriceHistory&goldPriceId=<id>&fromDate=DD/MM/YYYY&toDate=DD/MM/YYYY` | VND per luong as-is; last quote per VN day | several updates per day | robots `User-agent: *` allows `/`; `ai-input=no` / `ai-train=no`: store numbers only, never page text | BTMC |
| BTMC (`gold_daily`, fallback) | `GET https://btmc.vn/Home/BGiaVang` (HTML table) | 1000 VND per chi -> x10 (luong) x1000 (VND) | intraday, current quote only | robots allows `/Home/`; disallows `/Areas/ /Data/ ...` | none |
| Vietcombank (`fx_daily`) | `GET https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx` (XML) | VND per USD: `buy_transfer`=Transfer, `sell`=Sell | intraday, current only (no history) | no robots.txt; "only one request every 5 minutes" enforced via `.cache/.vcb_last_fetch` | none |
| Kraken (`global_daily`) | `GET https://api.kraken.com/0/public/OHLC?pair=<XBTUSD|BNBUSD>&interval=1440&since=<unix>` (JSON) | close USD as-is (`close_usd`); VND via `fx_daily.buy_transfer` in loaders | daily (UTC candles) | public market-data API, no key; `api.kraken.com/robots.txt` is not a robots file (JSON error, parsed as no rules). Returns at most the last 720 candles regardless of `since`, so history is ~2 years | none |

## SJC notes
- goldPriceId: `1` = "Vang SJC 1L, 10L, 1KG" Ho Chi Minh -> `SJC_1L`;
  `49` = "Vang nhan SJC 99,99% 1 chi, 2 chi, 5 chi" Ho Chi Minh -> `SJC_RING_1C`.
  (`Id` in GetGoldPrice == `PriceId` in history rows.)
- History rejects windows of 90 days or more ("Chi duoc xem Gia trong khoang duoi 90 ngay"):
  we use 88-day windows with 2 s spacing (`taichinh backfill --source gold`).
- History `GroupDate` is a .NET `/Date(ms)/`; converted to Asia/Ho_Chi_Minh date.
- Vietcombank has no history: `fx_daily` grows one row per daily `taichinh fetch`.
  `load_close_series` back-fills the earliest known USD rate for older USD-asset dates.

## Banned sources (never use)
vnstock, Yahoo Finance, Stooq, CoinGecko, Binance, Metric (metric.vn) - including press quotes.
