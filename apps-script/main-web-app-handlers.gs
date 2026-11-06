/**
 * Web app entry points. Deploy: Execute as "Me", Who has access "Anyone" (the token guards the data).
 * Every path returns JSON; an uncaught error would come back as an HTML page,
 * which the browser reports as a CORS failure.
 */
var REQUEST_REPLAY_SECONDS = 21600;
var DASHBOARD_CACHE_KEY = 'dash_v1';
var DASHBOARD_CACHE_SECONDS = 120;
var DASHBOARD_CACHE_MAX_BYTES = 95000;
var BUSY_MESSAGE = 'Hệ thống đang bận, thử lại sau ít phút nhé.';
var BAD_REQUEST_MESSAGE = 'Dữ liệu không hợp lệ.';

/** No data on GET: opening the /exec URL in a browser only confirms the deployment works. */
function doGet() {
  return respondJson_(function () {
    return { ok: true, service: 'tai-chinh-ca-nhan' };
  });
}

/** Body (text/plain JSON): { t: token, action, data: {...}, requestId }. Reads: dashboard, history. Writes: ACTION_PLANNERS. */
function doPost(e) {
  return respondJson_(function () {
    var payload;
    try {
      payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      return { ok: false, error: BAD_REQUEST_MESSAGE };
    }
    if (!payload || typeof payload !== 'object') return { ok: false, error: BAD_REQUEST_MESSAGE };
    var auth = checkAccessToken_(payload.t);
    if (!auth.ok) return auth;

    var action = cleanText(payload.action, 30);
    var data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    if (action === 'dashboard') return readDashboard_(Boolean(data.nocache));
    if (action === 'history') return buildHistory(readState(), data);
    if (!Object.prototype.hasOwnProperty.call(ACTION_PLANNERS, action)) return { ok: false, error: 'Thao tác không hợp lệ.' };
    return runAction_(action, data, payload);
  });
}

/** Reads need no lock. The payload is cached for 2 minutes when it fits (cache values are capped near 100 KB). */
function readDashboard_(nocache) {
  var cache = CacheService.getScriptCache();
  if (!nocache) {
    var hit = cache.get(DASHBOARD_CACHE_KEY);
    if (hit) return JSON.parse(hit);
  }
  var dashboard = buildDashboardPayload(readState(), startOfDay(new Date()));
  var json = JSON.stringify(dashboard);
  if (Utilities.newBlob(json).getBytes().length < DASHBOARD_CACHE_MAX_BYTES) cache.put(DASHBOARD_CACHE_KEY, json, DASHBOARD_CACHE_SECONDS);
  return dashboard;
}

function runAction_(action, data, payload) {
  // One id per filled form: a retry after a timeout gets the first answer back instead of a duplicate.
  var requestId = typeof payload.requestId === 'string' ? payload.requestId.replace(/[^\w-]/g, '').slice(0, 64) : '';
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: BUSY_MESSAGE };
  try {
    var seen = requestId && cache.get('req_' + requestId);
    if (seen) {
      var again = readDashboard_(true);
      again.message = JSON.parse(seen).message;
      again.replayed = true;
      return again;
    }
    var state = readState();
    var now = new Date();
    var result = planAction(action, data, buildPlanContext(state, now, requestId));
    if (!result.ok) return result;

    if (!planIsEmpty(result.plan)) {
      applyPlan(result.plan, state);
      commitSequences_(result.plan);
      SpreadsheetApp.flush();
    }
    if (requestId && !result.replayed) cache.put('req_' + requestId, JSON.stringify({ message: result.message }), REQUEST_REPLAY_SECONDS);
    cache.remove(DASHBOARD_CACHE_KEY);

    var response = buildDashboardPayload(readState(), startOfDay(now));
    response.message = result.message;
    if (result.replayed) response.replayed = true;
    return response;
  } finally {
    lock.releaseLock();
  }
}

function respondJson_(handler) {
  var body;
  try {
    body = handler();
  } catch (err) {
    // The stack never contains the token: it is only read inside checkAccessToken_.
    console.error(err && err.stack ? err.stack : String(err));
    body = { ok: false, error: BUSY_MESSAGE };
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
