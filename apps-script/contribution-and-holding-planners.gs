/**
 * Money movements: contribution_add (deposit / withdraw, ledger row + holding change) and holding_set.
 * The Contributions row is the ledger; Holdings is the running balance derived from it.
 */

function findHolding(ctx, assetId, goalId) {
  return ctx.holdings.filter(function (h) {
    return String(h.asset_id) === String(assetId) && String(h.goal_id).toUpperCase() === String(goalId).toUpperCase();
  })[0] || null;
}

function isRateAsset(asset) {
  return String(asset.loai_gia).trim().toLowerCase() === 'lai_suat';
}

/** Units and unit price: typed values win, else the latest known price. Deposits count 1 unit per đồng. */
function resolveQuantity(data, asset, amount, ctx) {
  if (isRateAsset(asset)) return { so_luong: amount, gia_don_vi: 1 };
  var quantity = readNumber(data.so_luong, 'Số lượng', { min: 0, fallback: 0 });
  var unit = readNumber(data.gia_don_vi, 'Giá đơn vị', { min: 0, fallback: 0 });
  if (quantity > 0) {
    unit = unit > 0 ? unit : amount / quantity;
  } else if (unit > 0) {
    quantity = amount / unit;
  } else {
    unit = unitPriceVnd(ctx.index[asset.asset_id], ctx.tyGia);
    if (!(unit > 0)) fail('Chưa có giá cho "' + asset.ten + '". Nhập số lượng hoặc giá đơn vị.');
    quantity = amount / unit;
  }
  quantity = roundTo(quantity, 6);
  if (!(quantity > 0)) fail('Số tiền quá nhỏ so với giá một đơn vị.');
  return { so_luong: quantity, gia_don_vi: roundTo(unit, 2) };
}

function planContributionAdd(data, ctx) {
  // The page keeps one requestId per filled form, so a retry after a timeout lands here instead of double-writing.
  if (ctx.requestId && ctx.contributions.some(function (c) { return String(c.request_id) === ctx.requestId; })) {
    return { message: 'Đã ghi trước đó.', plan: emptyPlan(), replayed: true };
  }
  var goal = findGoal(ctx, data.goal_id, true);
  var asset = findAsset(ctx, data.asset_id);
  var type = readChoice(data.loai, CONTRIBUTION_TYPES, 'loại giao dịch (gửi hay rút)');
  var amount = readMoney(data.so_tien_vnd, 'Số tiền', true, ctx.config.gui_toi_da_1_lan);
  var date = readEventDate(data.ngay, ctx);
  var qty = resolveQuantity(data, asset, amount, ctx);
  var holding = findHolding(ctx, asset.asset_id, goal.goal_id);
  var plan = emptyPlan();
  var holdingChanges;
  if (type === 'rut') {
    var held = holding ? toNumberOrZero(holding.so_luong) : 0;
    if (qty.so_luong > held + 1e-6) fail('Rút nhiều hơn đang có (' + (isRateAsset(asset) ? formatShortVnd(held) : held + ' đơn vị') + ').');
    var left = roundTo(held - qty.so_luong, 6);
    var keepRatio = held > 0 ? left / held : 0;
    holdingChanges = { so_luong: left > 1e-6 ? left : 0, gia_von_vnd: left > 1e-6 ? Math.round(toNumberOrZero(holding.gia_von_vnd) * keepRatio) : 0 };
  } else {
    holdingChanges = {
      so_luong: roundTo(toNumberOrZero(holding && holding.so_luong) + qty.so_luong, 6),
      gia_von_vnd: Math.round(toNumberOrZero(holding && holding.gia_von_vnd) + amount)
    };
  }
  // Ledger first, then the balance: if the second write failed, the record of the money is still there.
  appendTo(plan, T.contributions, {
    thoi_gian: ctx.now, ngay: date, loai: type, goal_id: goal.goal_id, asset_id: asset.asset_id, so_tien_vnd: amount,
    so_luong: qty.so_luong, gia_don_vi: qty.gia_don_vi, ghi_chu: cleanText(data.ghi_chu, 200), request_id: ctx.requestId
  });
  holdingChanges.cap_nhat_luc = ctx.now;
  if (holding) {
    updateIn(plan, T.holdings, holdingKey(holding.asset_id, holding.goal_id), holdingChanges);
  } else {
    appendTo(plan, T.holdings, Object.assign({ asset_id: asset.asset_id, goal_id: goal.goal_id }, holdingChanges));
  }
  var verb = type === 'gui' ? 'gửi' : 'rút';
  return { message: 'Đã ghi ' + verb + ' ' + formatShortVnd(amount) + ' (' + asset.ten + ') cho "' + goal.ten + '".', plan: plan };
}

/** Overwrite a holding, e.g. after checking the real broker / bank balance. */
function planHoldingSet(data, ctx) {
  var goal = findGoal(ctx, data.goal_id, false);
  var asset = findAsset(ctx, data.asset_id);
  var quantity = roundTo(readNumber(data.so_luong, 'Số lượng', { required: true, min: 0, max: 1e12 }), 6);
  var holding = findHolding(ctx, asset.asset_id, goal.goal_id);
  var cost;
  if (data.gia_von_vnd !== '' && data.gia_von_vnd != null) {
    cost = readMoney(data.gia_von_vnd, 'Giá vốn', false, LIMITS.goalVnd);
  } else if (holding) {
    cost = toNumberOrZero(holding.gia_von_vnd);
  } else {
    cost = Math.round(quantity * (isRateAsset(asset) ? 1 : unitPriceVnd(ctx.index[asset.asset_id], ctx.tyGia)));
  }
  var changes = { so_luong: quantity, gia_von_vnd: cost, cap_nhat_luc: ctx.now };
  var plan = emptyPlan();
  if (holding) {
    updateIn(plan, T.holdings, holdingKey(holding.asset_id, holding.goal_id), changes);
  } else {
    appendTo(plan, T.holdings, Object.assign({ asset_id: asset.asset_id, goal_id: goal.goal_id }, changes));
  }
  return { message: 'Đã cập nhật số dư ' + asset.ten + ' của "' + goal.ten + '".', plan: plan };
}
