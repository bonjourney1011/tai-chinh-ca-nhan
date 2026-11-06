// Reads money the way it is typed on a phone: "12tr5", "12,5tr", "800k", "12.500.000".
// A bare small number takes the field's unit: "12" = 12tr on a price, "300" = 300k on a fee.
// Returns whole đồng, or null when the text cannot be read. The form always shows the parsed amount.

const BILLION_UNITS = /^(\d+(?:[.,]\d+)?)(?:tỷ|tỉ|ty|ti|b)$/;
const BILLION_WITH_TAIL = /^(\d+)(?:tỷ|tỉ|ty|ti)(\d{1,3})$/;
const MILLION_UNITS =/^(\d+(?:[.,]\d+)?)(?:tr|triệu|trieu|m|củ|cu)$/;
const MILLION_WITH_TAIL = /^(\d+)(?:tr|triệu|trieu|m|củ|cu)(\d{1,3})$/;
const THOUSAND_UNITS = /^(\d+(?:[.,]\d+)?)(?:k|nghìn|nghin|ngàn|ngan)$/;
const GROUPED = /^\d{1,3}(?:[.,]\d{3})+$/;
const PLAIN = /^\d+(?:[.,]\d+)?$/;

const toNumber = (text) => Number(text.replace(',', '.'));

export function parseMoney(input, unit = 'tr') {
  const text = String(input ?? '').toLowerCase().replace(/\s+/g, '').replace(/(?:đ|vnd|vnđ|dong|đồng)$/, '');
  if (!text) return null;
  let match = BILLION_WITH_TAIL.exec(text);
  // "1tỷ5" = 1,5 tỷ.
  if (match) return Math.round(Number(`${match[1]}.${match[2]}`) * 1e9);
  match = BILLION_UNITS.exec(text);
  if (match) return Math.round(toNumber(match[1]) * 1e9);
  match = MILLION_WITH_TAIL.exec(text);
  // "12tr5" = 12,5tr; the digits after "tr" are the decimal part.
  if (match) return Math.round(Number(`${match[1]}.${match[2]}`) * 1e6);
  match = MILLION_UNITS.exec(text);
  if (match) return Math.round(toNumber(match[1]) * 1e6);
  match = THOUSAND_UNITS.exec(text);
  if (match) return Math.round(toNumber(match[1]) * 1e3);
  if (GROUPED.test(text)) return Number(text.replace(/[.,]/g, ''));
  if (PLAIN.test(text)) {
    const value = toNumber(text);
    // Nobody pays 12đ or 300đ: small bare numbers are in the field's unit, big ones are full đồng.
    if (unit === 'k') return value < 100000 ? Math.round(value * 1e3) : Math.round(value);
    return value < 1000 ? Math.round(value * 1e6) : Math.round(value);
  }
  return null;
}
