/**
 * Plain rules that point out what deserves a look in a month.
 * No AI involved: these run on the device, instantly and for free.
 */
import { base, monthStatement, propertyStatement } from './calc';
import { addMonths, diffDays } from './dates';
import type { Data, ID, Month } from './types';

export type Insight =
  | { kind: 'rent_gap'; property_id: ID; missing: number; nights: number | null }
  | { kind: 'spike'; property_id: ID; category: string; amount: number; usual: number }
  | { kind: 'duplicate'; property_id: ID; expense_id: ID; amount: number; label: string }
  | { kind: 'overlap'; property_id: ID; booking_id: ID; check_in: string };

/** Categories that are irregular by nature and would trigger false alarms. */
const LUMPY = new Set(['rent', 'equipment', 'taxes']);

export function insightsFor(data: Data, propertyId: ID | null, month: Month): Insight[] {
  const out: Insight[] = [];
  const properties = data.properties.filter(
    (p) => !p.archived && (propertyId === null || p.id === propertyId),
  );

  for (const property of properties) {
    const s = monthStatement(data, property.id, month);

    if (s.rentCovered === false) {
      const recent = propertyStatement(data, property, (m) => m <= month && m >= addMonths(month, -3));
      const missing = s.rent - s.revenue;
      out.push({
        kind: 'rent_gap',
        property_id: property.id,
        missing,
        nights: recent.avgPerNight ? Math.ceil(missing / recent.avgPerNight) : null,
      });
    }

    const before = [1, 2, 3].map((n) => monthStatement(data, property.id, addMonths(month, -n)));
    for (const [category, amount] of Object.entries(s.byCategory)) {
      if (LUMPY.has(category)) continue;
      const past = before.map((b) => b.byCategory[category] ?? 0).filter((v) => v > 0);
      if (past.length < 2) continue;
      const usual = past.reduce((t, v) => t + v, 0) / past.length;
      if (amount > usual * 1.6 && amount - usual > s.expenses * 0.03)
        out.push({ kind: 'spike', property_id: property.id, category, amount, usual });
    }

    const rows = s.expenseRows.filter((x) => !x.excluded && !x.recurring_id);
    rows.forEach((a, i) => {
      const twin = rows.slice(i + 1).find(
        (b) =>
          b.currency === a.currency &&
          b.amount === a.amount &&
          b.category === a.category &&
          b.vendor.trim().toLowerCase() === a.vendor.trim().toLowerCase() &&
          Math.abs(diffDays(a.date, b.date)) <= 2,
      );
      if (twin)
        out.push({
          kind: 'duplicate',
          property_id: property.id,
          expense_id: twin.id,
          amount: base(twin),
          label: twin.vendor || twin.description,
        });
    });

    const stays = s.bookings.filter((b) => b.check_out);
    stays.forEach((a, i) => {
      const clash = stays
        .slice(i + 1)
        .find((b) => a.check_in < b.check_out! && b.check_in < a.check_out!);
      if (clash)
        out.push({ kind: 'overlap', property_id: property.id, booking_id: clash.id, check_in: clash.check_in });
    });
  }
  return out;
}
