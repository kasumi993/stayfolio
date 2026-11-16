/**
 * Recurring expenses.
 *
 * A recurring expense is a template. Each month it produces one ordinary
 * expense row, which can then be edited, given a receipt, or excluded for that
 * month only. Excluding keeps the row (so it is not generated again) but
 * leaves it out of every total; the template and future months are untouched.
 */
import { dateInMonth, monthRange } from './dates';
import { newId, now } from './id';
import type { Data, Expense, Month } from './types';

/** Expense rows that should exist up to `upTo` but have not been generated yet. */
export function dueOccurrences(data: Data, upTo: Month): Expense[] {
  const existing = new Set(
    data.expenses.filter((x) => x.recurring_id).map((x) => `${x.recurring_id}|${x.month}`),
  );
  const out: Expense[] = [];
  for (const r of data.recurring) {
    const last = r.end_month && r.end_month < upTo ? r.end_month : upTo;
    for (const month of monthRange(r.start_month, last)) {
      if (existing.has(`${r.id}|${month}`)) continue;
      out.push({
        id: newId(),
        property_id: r.property_id,
        date: dateInMonth(month, r.day),
        month,
        category: r.category,
        vendor: r.vendor,
        description: r.description,
        currency: r.currency,
        amount: r.amount,
        fx_rate: r.fx_rate,
        scope: r.scope,
        charged_to: null,
        paid_by: r.paid_by,
        recurring_id: r.id,
        excluded: false,
        created_at: now(),
      });
    }
  }
  return out;
}
