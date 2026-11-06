// ?demo=1 only: answers like the server would, without network and without saving anything.
import { demoPayload, demoHistoryRows } from './demo-payload.js';

export async function demoCall(action, data = {}) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (action === 'dashboard') return structuredClone(demoPayload);
  if (action === 'history') {
    const rows = demoHistoryRows(data.goal_id);
    const offset = Number(data.offset) || 0;
    return { ok: true, rows: rows.slice(offset, offset + (Number(data.limit) || 20)), total: rows.length };
  }
  return { ...structuredClone(demoPayload), message: 'Xem thử: chưa lưu gì cả.' };
}
