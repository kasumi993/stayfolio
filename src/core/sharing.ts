/**
 * Builds the statement an owner or partner is allowed to see.
 *
 * Privacy by construction: the statement is assembled field by field from an
 * explicit allow-list, then published as a frozen snapshot. The reader never
 * queries the live tables, so nothing outside this file can reach them:
 * no private expenses, no other property, no figures about my own earnings.
 */
import { balances, base, bookingMonth, commissionOf, nightsOf, propertyStatement, ruleFor } from './calc';
import { monthOf } from './dates';
import { now } from './id';
import { round } from './money';
import type { Data, ID, ISODate, Month } from './types';

export interface SharedStatement {
  version: 1;
  generated_at: string;
  /** `kind` is absent from statements published before it existed. */
  property: { name: string; location: string; color: string; kind?: string };
  /** The person the statement is addressed to. */
  audience: string;
  /** Who prepared it. */
  manager: string;
  currency: string;
  period: { from: Month; to: Month };
  bookings: { check_in: ISODate; check_out: ISODate | null; nights: number; platform: string; amount: number }[];
  expenses: { date: ISODate; category: string; vendor: string; description: string; amount: number }[];
  /** Money already exchanged with the audience during the period. */
  transfers: { date: ISODate; received: boolean; amount: number; note: string }[];
  months: { month: Month; revenue: number; expenses: number }[];
  totals: {
    revenue: number;
    expenses: number;
    /** Management fee, or null when the manager chose not to itemise it. */
    commission: number | null;
    /** The audience's share of revenue and of expenses. */
    shareRevenue: number;
    shareExpenses: number;
    /** The audience's result for the period. */
    net: number;
    /** What the audience is still owed for the period (negative: they owe). */
    due: number;
    nights: number;
  };
}

export interface ShareOptions {
  /**
   * true: bookings show the full payout and the management fee is one line.
   * false: bookings show the amount net of fees; the fee appears nowhere.
   */
  showCommission: boolean;
}

export function buildSharedStatement(
  data: Data,
  propertyId: ID,
  partyId: ID,
  months: Month[],
  opts: ShareOptions,
): SharedStatement {
  const property = data.properties.find((p) => p.id === propertyId);
  const party = data.parties.find((p) => p.id === partyId && p.property_id === propertyId);
  if (!property || !party || !months.length) throw new Error('invalid_share');

  const sorted = [...months].sort();
  const inPeriod = (m: Month) => sorted.includes(m);
  const s = propertyStatement(data, property, inPeriod);
  const line = s.parties.find((l) => l.party.id === partyId)!;
  const balance = balances(data, propertyId, inPeriod).find((b) => b.party.id === partyId)!;
  const money = (v: number) => round(v, 2);

  const bookings = s.bookings
    .map((b) => {
      const fee = commissionOf(b, ruleFor(data.rules, propertyId, bookingMonth(b, property)));
      return {
        check_in: b.check_in,
        check_out: b.check_out,
        nights: nightsOf(b),
        platform: b.platform,
        amount: money(base(b) - (opts.showCommission ? 0 : fee)),
      };
    })
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  const expenses = s.expenseRows
    .filter((x) => x.scope === 'property' && !x.excluded)
    .map((x) => ({
      date: x.date,
      category: x.category,
      vendor: x.vendor,
      description: x.description,
      amount: money(base(x)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const transfers = data.transfers
    .filter(
      (t) =>
        t.property_id === propertyId &&
        inPeriod(monthOf(t.date)) &&
        (t.from_party === partyId || t.to_party === partyId),
    )
    .map((t) => ({ date: t.date, received: t.to_party === partyId, amount: money(t.amount), note: t.note }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    version: 1,
    generated_at: now(),
    property: { name: property.name, location: property.location, color: property.color, kind: property.kind },
    audience: party.name,
    manager: data.profile.name,
    currency: data.profile.currency,
    period: { from: sorted[0], to: sorted[sorted.length - 1] },
    bookings,
    expenses,
    transfers,
    months: sorted.map((month) => {
      const m = propertyStatement(data, property, (x) => x === month);
      return {
        month,
        revenue: money(m.revenue - (opts.showCommission ? 0 : m.commission)),
        expenses: money(m.expenses),
      };
    }),
    totals: {
      revenue: money(s.revenue - (opts.showCommission ? 0 : s.commission)),
      expenses: money(s.expenses),
      commission: opts.showCommission ? money(s.commission) : null,
      shareRevenue: money(line.revenue),
      shareExpenses: money(line.expenses),
      net: money(line.net),
      due: money(balance.balance),
      nights: s.nights,
    },
  };
}
