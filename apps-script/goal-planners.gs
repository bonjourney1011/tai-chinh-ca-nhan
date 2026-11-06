/** Goal actions: goal_save, goal_choose_plan, goal_set_status. Pure: they only return plans. */

function readGoalDeadline(data, ctx) {
  var date;
  if (data.ngay_dich) {
    date = parseIsoDate(data.ngay_dich);
    if (!date) fail('Ngày đích không hợp lệ.');
  } else if (data.so_thang !== '' && data.so_thang != null) {
    date = addMonths(ctx.today, Math.round(readNumber(data.so_thang, 'Số tháng', { min: 1, max: LIMITS.goalMonths })));
  } else {
    fail('Nhập ngày đích hoặc số tháng.');
  }
  if (daysBetween(ctx.today, date) <= 0) fail('Ngày đích phải sau hôm nay.');
  if (date.getTime() > addMonths(ctx.today, LIMITS.goalYears * 12).getTime()) fail('Ngày đích xa quá ' + LIMITS.goalYears + ' năm.');
  return date;
}

function readGoalAmount(value, currency) {
  var amount = readNumber(value, 'Số tiền mục tiêu', { required: true });
  if (amount <= 0) fail('Số tiền mục tiêu phải lớn hơn 0.');
  var cap = currency === 'USD' ? LIMITS.goalUsd : LIMITS.goalVnd;
  if (amount > cap) fail('Số tiền mục tiêu quá lớn (tối đa ' + (currency === 'USD' ? formatVnd(cap) + ' USD' : formatShortVnd(cap)) + '), kiểm tra lại "tr" hay "k".');
  return currency === 'USD' ? roundTo(amount, 2) : Math.round(amount);
}

/** "Ước tính 4,2 triệu/tháng": rough deposit at the profile's expected return, before the full Python plans exist. */
function quickEstimateText(goal, ctx) {
  var months = monthsUntil(ctx.today, goal.ngay_dich);
  var pmt = requiredPmt(goal.so_tien_dich, goal.tien_co_san, months, expectedReturn(ctx.config, goal.ho_so_rui_ro));
  if (pmt <= 0) return 'Tiền có sẵn đã đủ cho mục tiêu này nếu giữ đến hạn.';
  return 'Ước tính ' + (isUsdGoal(goal) ? Math.round(pmt) + ' USD' : formatTrieu(pmt)) + '/tháng (còn ' + months + ' tháng).';
}

function planGoalSave(data, ctx) {
  var existing = data.goal_id ? findGoal(ctx, data.goal_id, false) : null;
  if (!existing && ctx.goals.length >= LIMITS.maxGoals) fail('Đã có tối đa ' + LIMITS.maxGoals + ' mục tiêu. Xoá hoặc đóng bớt trước khi thêm.');
  var currency = readChoice(data.tien_te, CURRENCIES, 'loại tiền', existing ? existing.tien_te : 'VND');
  var goal = {
    ten: readText(data.ten, 'Tên mục tiêu', 2, 60, true),
    so_tien_dich: readGoalAmount(data.so_tien_dich, currency),
    tien_te: currency,
    ngay_dich: readGoalDeadline(data, ctx),
    tien_co_san: readNumber(data.tien_co_san, 'Tiền có sẵn', { min: 0, max: LIMITS.goalVnd }),
    ho_so_rui_ro: readChoice(data.ho_so_rui_ro, RISK_PROFILES, 'hồ sơ rủi ro', ctx.config.ho_so_mac_dinh),
    uu_tien: readChoice(data.uu_tien, PRIORITIES, 'mức ưu tiên', 'vua'),
    ghi_chu: cleanText(data.ghi_chu, 200)
  };
  goal.tien_co_san = currency === 'USD' ? roundTo(goal.tien_co_san, 2) : Math.round(goal.tien_co_san);
  var plan = emptyPlan();
  var message;
  if (existing) {
    goal.cap_nhat_luc = ctx.now;
    updateIn(plan, T.goals, existing.goal_id, goal);
    message = 'Đã cập nhật mục tiêu "' + goal.ten + '". ' + quickEstimateText(goal, ctx);
  } else {
    var next = nextSeqId('goal', ctx.seq.goal, ctx.goals.map(function (g) { return g.goal_id; }));
    goal.goal_id = next.id;
    goal.phuong_an_chon = '';
    goal.trang_thai = 'dang';
    goal.tao_luc = ctx.now;
    goal.cap_nhat_luc = ctx.now;
    appendTo(plan, T.goals, goal);
    plan.seq[SEQUENCES.goal.prop] = next.seq;
    message = 'Đã thêm mục tiêu "' + goal.ten + '". ' + quickEstimateText(goal, ctx);
  }
  return { message: message, plan: plan };
}

function planGoalChoosePlan(data, ctx) {
  var goal = findGoal(ctx, data.goal_id, true);
  var option = readChoice(data.phuong_an, PLAN_OPTIONS, 'phương án');
  var available = ctx.planRows.some(function (row) {
    return String(row.goal_id).toUpperCase() === String(goal.goal_id).toUpperCase() && row.phuong_an === option;
  });
  if (!available) fail('Phương án này chưa được tính cho mục tiêu "' + goal.ten + '". Đợi lần cập nhật tự động kế tiếp.');
  var plan = emptyPlan();
  updateIn(plan, T.goals, goal.goal_id, { phuong_an_chon: option, cap_nhat_luc: ctx.now });
  return { message: 'Đã chọn phương án cho "' + goal.ten + '".', plan: plan };
}

function planGoalSetStatus(data, ctx) {
  var goal = findGoal(ctx, data.goal_id, false);
  var status = readChoice(data.trang_thai, GOAL_STATUS, 'trạng thái');
  var plan = emptyPlan();
  updateIn(plan, T.goals, goal.goal_id, { trang_thai: status, cap_nhat_luc: ctx.now });
  var label = { dang: 'đang theo dõi', da_dat: 'đã đạt', huy: 'đã huỷ' }[status];
  return { message: 'Mục tiêu "' + goal.ten + '" ' + label + '.', plan: plan };
}
