/**
 * Pure goal maths, same formulas as src/taichinh/engine/goal_math.py (end-of-month deposits).
 * Used for the instant "Ước tính" and the budget levers; the full plans come from the Python side.
 */
var NEVER_MONTHS = 1200;

function monthlyRate(annualRate) {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** Monthly deposit that grows pv into target within n months (never negative). */
function requiredPmt(target, pv, n, annualRate) {
  if (n <= 0) return Math.max(0, target - pv);
  var r = monthlyRate(annualRate);
  if (Math.abs(r) < 1e-9) return Math.max(0, (target - pv) / n);
  var g = Math.pow(1 + r, n);
  return Math.max(0, (target - pv * g) * r / (g - 1));
}

/** Months to reach target depositing pmt a month; 0 when already there, null when never. */
function monthsToGoal(target, pv, pmt, annualRate) {
  if (pv >= target) return 0;
  var r = monthlyRate(annualRate);
  if (Math.abs(r) < 1e-9) return pmt > 0 ? (target - pv) / pmt : null;
  var num = target * r + pmt;
  var den = pv * r + pmt;
  if (num <= 0 || den <= 0 || num <= den) return null;
  return Math.log(num / den) / Math.log(1 + r);
}

function isUsdGoal(goal) {
  return String(goal.tien_te).toUpperCase() === 'USD';
}

function vndToGoalCurrency(vnd, goal, tyGia) {
  return isUsdGoal(goal) ? vnd / tyGia : vnd;
}

function goalCurrencyToVnd(amount, goal, tyGia) {
  return isUsdGoal(goal) ? amount * tyGia : amount;
}

/** Quick monthly deposit in VND to hit the goal on time at the profile's expected return. pv is in goal currency. */
function estimateMonthlyVnd(goal, pv, today, config, tyGia) {
  var deadline = toDayOrNull(goal.ngay_dich);
  if (!deadline) return 0;
  var months = monthsUntil(today, deadline);
  var rate = expectedReturn(config, goal.ho_so_rui_ro);
  return Math.round(goalCurrencyToVnd(requiredPmt(Number(goal.so_tien_dich) || 0, pv, months, rate), goal, tyGia));
}

/** Months saved versus the baseline when depositing `extra` more each month (never = NEVER_MONTHS). */
function monthsSaved(target, pv, basePmt, extra, annualRate) {
  var base = monthsToGoal(target, pv, basePmt, annualRate);
  var better = monthsToGoal(target, pv, basePmt + extra, annualRate);
  return Math.max(0, (base == null ? NEVER_MONTHS : base) - (better == null ? NEVER_MONTHS : better));
}
