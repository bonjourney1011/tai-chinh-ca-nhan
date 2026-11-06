/** Manual market prices (assets without an automatic source) and the Config settings page. Pure planners. */

function planPriceManualAdd(data, ctx) {
  var asset = findAsset(ctx, data.asset_id);
  if (!isTruthyFlag(asset.nhap_tay)) fail('"' + asset.ten + '" có giá tự động, không cần nhập tay.');
  var date = readEventDate(data.ngay, ctx);
  var entry = ctx.index[asset.asset_id];
  var row = { thoi_gian: ctx.now, ngay: date, asset_id: asset.asset_id, gia: '', lai_suat_nam: '', ghi_chu: cleanText(data.ghi_chu, 200) };
  if (isRateAsset(asset)) {
    var rate = readNumber(data.lai_suat_nam, 'Lãi suất', { required: true, min: 0, max: LIMITS.manualRateMax });
    row.lai_suat_nam = roundTo(rate / 100, 5);
  } else {
    var price = readNumber(data.gia, 'Giá', { required: true, min: 0 });
    if (price <= 0) fail('Giá phải lớn hơn 0.');
    var last = entry ? Number(entry.gia) : 0;
    if (last > 0 && Math.abs(price - last) / last > LIMITS.priceJump) {
      fail('Giá ' + formatVnd(price) + ' lệch quá ' + Math.round(LIMITS.priceJump * 100) + '% so với giá gần nhất (' + formatVnd(last) + '). Kiểm tra lại số 0 hoặc đơn vị.');
    }
    row.gia = price;
  }
  var plan = emptyPlan();
  appendTo(plan, T.manualPrices, row);
  return { message: 'Đã ghi giá ' + asset.ten + ' ngày ' + formatDayMonth(date) + '.', plan: plan };
}

function readConfigValue(key, value) {
  if (key === 'ho_so_mac_dinh') return readChoice(value, RISK_PROFILES, 'hồ sơ mặc định');
  if (key === 'kich_ban') return readChoice(value, SCENARIOS, 'kịch bản');
  var number = parseConfigNumber(value);
  if (key === 'tai_san_nuoc_ngoai' && number !== 0 && number !== 1) fail('Tài sản nước ngoài chỉ nhận 0 hoặc 1.');
  if (isNaN(number)) fail('Giá trị "' + key + '" không hợp lệ.');
  var rule = CONFIG_RULES[key];
  if (rule && (number < rule.min || number > rule.max)) fail('Giá trị "' + key + '" phải từ ' + rule.min + ' đến ' + rule.max + '.');
  return number;
}

function planConfigSave(data, ctx) {
  var values = data.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail('Không có thiết lập nào để lưu.');
  var keys = Object.keys(values);
  if (!keys.length) fail('Không có thiết lập nào để lưu.');
  var plan = emptyPlan();
  keys.forEach(function (key) {
    if (CONFIG_EDITABLE_KEYS.indexOf(key) === -1) fail('Không được sửa thiết lập "' + cleanText(key, 40) + '" từ trang này.');
    var value = String(readConfigValue(key, values[key]));
    if (ctx.configKeys[key]) updateIn(plan, T.config, key, { value: value });
    else appendTo(plan, T.config, { key: key, value: value, ghi_chu: '' });
  });
  return { message: 'Đã lưu ' + keys.length + ' thiết lập.', plan: plan };
}
