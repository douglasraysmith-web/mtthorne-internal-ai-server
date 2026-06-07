import { findRepeatRisk } from '../servers/errorLedger.js';

export function errorLedgerLane(input, route) {
  const risk = findRepeatRisk(input.text || input.message || '', route.project_room);
  return { lane: 'error_ledger', ok: true, ...risk };
}
