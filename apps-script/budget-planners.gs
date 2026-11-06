/** Budget actions: budget_save (income / expense / debt line) and budget_delete (soft). Pure planners. */

function findBudgetRow(ctx, budgetId) {
  var wanted = cleanText(budgetId, 20).toUpperCase();
  var row = ctx.budget.filter(function (item) { return String(item.budget_id).toUpperCase() === wanted; })[0];
  if (!row) fail('Không tìm thấy dòng ngân sách ' + (wanted || '(chưa chọn)') + '.');
  return row;
}

function planBudgetSave(data, ctx) {
  var existing = data.budget_id ? findBudgetRow(ctx, data.budget_id) : null;
  if (!existing && ctx.budget.length >= LIMITS.maxBudgetRows) fail('Ngân sách đã quá nhiều dòng, xoá bớt dòng cũ trong Sheet.');
  var type = readChoice(data.loai, BUDGET_TYPES, 'loại khoản');
  var isDebt = type === 'no';
  var row = {
    loai: type,
    ten: readText(data.ten, 'Tên khoản', 2, 60, true),
    so_tien: readMoney(data.so_tien, isDebt ? 'Dư nợ' : 'Số tiền', true, isDebt ? LIMITS.budgetDebt : LIMITS.budgetMonthly),
    chu_ky: isDebt ? 'thang' : readChoice(data.chu_ky, BUDGET_CYCLES, 'chu kỳ', 'thang'),
    lai_suat_nam: '',
    tra_toi_thieu: '',
    ghi_chu: cleanText(data.ghi_chu, 200),
    trang_thai: 'dang',
    cap_nhat_luc: ctx.now
  };
  if (isDebt) {
    // The page types percent (12 = 12%/năm); the Sheet stores the decimal so the Python reader never guesses.
    var rate = readNumber(data.lai_suat_nam, 'Lãi suất', { min: 0, max: 100, fallback: '' });
    row.lai_suat_nam = rate === '' ? '' : roundTo(rate / 100, 5);
    row.tra_toi_thieu = readMoney(data.tra_toi_thieu, 'Trả tối thiểu', false, row.so_tien);
  }
  var plan = emptyPlan();
  if (existing) {
    updateIn(plan, T.budget, existing.budget_id, row);
    return { message: 'Đã cập nhật "' + row.ten + '".', plan: plan };
  }
  var next = nextSeqId('budget', ctx.seq.budget, ctx.budget.map(function (b) { return b.budget_id; }));
  row.budget_id = next.id;
  appendTo(plan, T.budget, row);
  plan.seq[SEQUENCES.budget.prop] = next.seq;
  return { message: 'Đã thêm "' + row.ten + '" vào ngân sách.', plan: plan };
}

function planBudgetDelete(data, ctx) {
  var row = findBudgetRow(ctx, data.budget_id);
  var plan = emptyPlan();
  updateIn(plan, T.budget, row.budget_id, { trang_thai: 'xoa', cap_nhat_luc: ctx.now });
  return { message: 'Đã xoá "' + row.ten + '" khỏi ngân sách.', plan: plan };
}
