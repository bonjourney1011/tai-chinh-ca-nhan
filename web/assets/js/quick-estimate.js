// "Ước tính nhanh": the monthly saving needed to reach a target, from one assumed yearly return.
// Only a hint while typing; the real plan comes from the monthly calculator.
export const DEFAULT_RETURN = 0.08;

export function expectedReturn(settings) {
  let rate = Number(settings?.ky_vong_loi_nhuan);
  if (rate > 1) rate /= 100;
  return rate > 0 ? rate : DEFAULT_RETURN;
}

/** Whole months from today (yyyy-mm-dd) to a later date; 0 when the date is empty or past. */
export function monthsUntil(todayIso, targetIso) {
  if (!todayIso || !targetIso) return 0;
  const [y1, m1, d1] = todayIso.split('-').map(Number);
  const [y2, m2, d2] = targetIso.split('-').map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return Math.max(0, months);
}

/** Payment per month so that savings plus deposits reach the target. Returns 0 when nothing is needed. */
export function quickMonthly({ target, have = 0, months, annualReturn = DEFAULT_RETURN }) {
  if (!(target > 0) || !(months > 0)) return null;
  const i = annualReturn / 12;
  const growth = (1 + i) ** months;
  const gap = target - have * growth;
  if (gap <= 0) return 0;
  return Math.ceil((gap * i) / (growth - 1));
}
