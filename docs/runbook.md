# Runbook

## Monthly ritual (≈10 minutes)
1. Open the web page → tab **Thị trường** → enter this month's deposit rate, bond-fund NAV (and 10Y yield if you track it).
2. Wait for the 1st-of-month Actions run (08:17 ICT) or trigger **monthly-refresh** manually (Actions → Run workflow).
3. Check `Run_Log` in the Sheet (or the page header "Số liệu tính lúc …"). Failed sources are listed in `sources_failed`.
4. Review each goal's plan; log contributions in **Ghi sổ** as you make them.

## If the Actions runner cannot reach a VN site
Run the same CLI locally: `uv run taichinh run-monthly` (needs `.env`), then `git add data/market && git commit -m "data: monthly refresh" && git push`.
Optional: register a Windows Task Scheduler job that runs that command on the 1st.

## Redeploy Apps Script after editing `.gs`
Apps Script editor → Deploy → Manage deployments → ✏️ → Version: New → Deploy. The `/exec` URL stays the same.

## Rotate the page token
Sheet (desktop) → menu **Tài chính** → 🔑 Tạo link mới. On a phone, open the Apps Script editor and run `rotateTokenFromEditor()`. Old links stop working immediately.

## Rotate the service-account key
GCP console → Service accounts → Keys → Add key → update GitHub secret `GSPREAD_SA_JSON` → delete the old key.
