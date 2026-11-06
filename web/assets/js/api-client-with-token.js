import { SITE_CONFIG } from './site-config.js';

// Generous: a cold Apps Script start + lock wait + sheet writes can take 20 s+.
const TIMEOUT_MS = 45000;
const TOKEN_KEY = 'tai_chinh_token';
const NETWORK_ERROR = 'Mạng chập chờn hoặc hệ thống đang bận. Thử lại nhé.';

export const isApiConfigured = () => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(SITE_CONFIG.apiUrl);

/**
 * The private link is ".../#t=<token>". First visit stores the token on this phone and wipes it
 * from the address bar, so it does not linger in screenshots or shared tabs.
 */
export function captureToken() {
  const match = /(?:^|[#&])t=([\w-]{20,80})/.exec(window.location.hash);
  if (match) {
    try { localStorage.setItem(TOKEN_KEY, match[1]); } catch { /* private mode: token lives for this visit only */ }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return match[1];
  }
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function forgetToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* nothing stored */ }
}

let token = '';
export const setToken = (value) => { token = value; };

/**
 * POST as text/plain (fetch's default for a string body) so the browser sends a "simple"
 * request without a CORS preflight, which Apps Script cannot answer. Token rides in the body.
 * requestId: one per filled form, reused on retry, so a save that timed out is never written twice.
 */
export async function callApi(action, data, requestId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const body = { t: token, action, data, requestId };
  try {
    const response = await fetch(SITE_CONFIG.apiUrl, {
      method: 'POST', body: JSON.stringify(body), signal: controller.signal, redirect: 'follow'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return json && typeof json.ok === 'boolean' ? json : { ok: false, error: NETWORK_ERROR };
  } catch (error) {
    console.warn('API lỗi', error);
    return { ok: false, error: NETWORK_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
