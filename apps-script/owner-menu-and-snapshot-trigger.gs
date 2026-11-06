/**
 * "Tài chính" menu in the Sheet (desktop) + the 7:00 daily snapshot that feeds the trend chart.
 * The token is shown only in the owner's own dialog; it is never logged or emailed.
 */
var SNAPSHOT_HANDLER = 'runDailySnapshot';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tài chính')
    .addItem('🔑 Tạo link mới cho anh (link cũ hết hiệu lực)', 'createOwnerLink')
    .addItem('⏰ Bật chụp số liệu 7h sáng hằng ngày', 'installSnapshotTrigger')
    .addItem('📸 Chụp số liệu ngay', 'runSnapshotWithToast')
    .addToUi();
}

function createOwnerLink() {
  var token = rotateAccessToken_();
  var siteUrl = String(readState().config.site_url || '').trim();
  var link = siteUrl ? siteUrl.replace(/#.*$/, '') + '#t=' + token : '(Chưa điền site_url trong tab Config) token: ' + token;
  var html = HtmlService.createHtmlOutput(
    '<p style="font:14px sans-serif">Gửi link này cho anh qua tin nhắn riêng. Mở 1 lần là trang tự nhớ.</p>' +
    '<textarea readonly style="width:100%;height:90px;font:13px monospace" onclick="this.select()">' +
    escapeHtml_(link) + '</textarea>'
  ).setWidth(460).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Link riêng cho anh');
}

/** Same as the menu item, for running from the editor when the menu is not visible. */
function rotateTokenFromEditor() {
  createOwnerLink();
}

function escapeHtml_(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function installSnapshotTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === SNAPSHOT_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(SNAPSHOT_HANDLER).timeBased().everyDays(1).atHour(7).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã bật: mỗi sáng 7h ghi tổng tài sản cho biểu đồ.', 'Tài chính', 6);
}

function runSnapshotWithToast() {
  runDailySnapshot();
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã chụp số liệu hôm nay.', 'Tài chính', 6);
}

/** Writes today's row (tổng, từng nhóm, nợ) to Snapshot. Runs from the time trigger, so it needs the lock like a write. */
function runDailySnapshot() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    var today = startOfDay(new Date());
    writeSnapshot(today, buildDashboardPayload(readState(), today).summary);
    CacheService.getScriptCache().remove(DASHBOARD_CACHE_KEY);
  } catch (err) {
    console.error('Snapshot failed', err && err.stack ? err.stack : String(err));
  } finally {
    lock.releaseLock();
  }
}
