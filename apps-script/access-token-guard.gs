/**
 * The web app is reachable by anyone who knows its URL, so every call must carry the secret token
 * stored in Script Property ACCESS_TOKEN (created from the Sheet menu). The right token always
 * passes; a burst of wrong ones is answered "locked" so junk traffic cannot lock the owner out.
 */
var TOKEN_PROPERTY = 'ACCESS_TOKEN';
var MAX_BAD_TOKENS = 5;
var BAD_TOKEN_WINDOW_SECONDS = 600;
var UNAUTHORIZED_MESSAGE = 'Link không đúng hoặc đã được đổi. Xin link mới.';

function checkAccessToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!expected) return { ok: false, error: 'Chưa tạo link: mở Sheet → menu Tài chính → Tạo link mới.' };
  if (typeof token === 'string' && token === expected) return { ok: true };
  var cache = CacheService.getScriptCache();
  var badCount = Number(cache.get('bad_token_count') || 0);
  // No "unauthorized" flag while locked: the page must not forget a token that may still be valid.
  if (badCount >= MAX_BAD_TOKENS) return { ok: false, error: 'Hệ thống tạm khoá 10 phút vì có nhiều lần truy cập sai.' };
  cache.put('bad_token_count', String(badCount + 1), BAD_TOKEN_WINDOW_SECONDS);
  return { ok: false, unauthorized: true, error: UNAUTHORIZED_MESSAGE };
}

/** 40 random hex characters; replacing it logs out every old link at once. */
function rotateAccessToken_() {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 40);
  PropertiesService.getScriptProperties().setProperty(TOKEN_PROPERTY, token);
  CacheService.getScriptCache().remove('bad_token_count');
  return token;
}
