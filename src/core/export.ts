/**
 * Exports everything to an Excel workbook: a readable backup, and the
 * guarantee that the data can always leave the app.
 */
import { base, bookingMonth, dataSpan, nightsOf, series } from './calc';
import { monthRange } from './dates';
import { round } from './money';
import type { Data } from './types';
import { type Cell, writeWorkbook } from './xlsx';

export function exportWorkbook(data: Data): Uint8Array {
  const property = new Map(data.properties.map((p) => [p.id, p]));
  const party = new Map(data.parties.map((p) => [p.id, p.name]));
  const name = (id: string | null) => (id ? (property.get(id)?.name ?? '') : '');
  const who = (id: string | null) => (id ? (party.get(id) ?? '') : '');
  const cur = data.profile.currency;

  const revenue: Cell[][] = [
    ['Property', 'Date_Received', 'Platform', 'Guest', 'CheckIn', 'CheckOut', 'Nights', 'Currency', 'Net_Payout', 'FX_Rate', `Net_Payout_${cur}`, 'Month', 'Commission_Rate', 'Notes'],
    ...[...data.bookings]
      .sort((a, b) => a.check_in.localeCompare(b.check_in))
      .map((b): Cell[] => [name(b.property_id), b.received_on, b.platform, b.guest, b.check_in, b.check_out, nightsOf(b), b.currency, b.amount, b.fx_rate, round(base(b), 2), bookingMonth(b, property.get(b.property_id)), b.commission_rate, b.notes]),
  ];

  const expenses: Cell[][] = [
    ['Property', 'Date', 'Month', 'Category', 'Vendor', 'Description', 'Currency', 'Amount', 'FX_Rate', `Amount_${cur}`, 'Scope', 'Charged_To', 'Paid_By', 'Recurring', 'Excluded'],
    ...[...data.expenses]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x): Cell[] => [name(x.property_id), x.date, x.month, x.category, x.vendor, x.description, x.currency, x.amount, x.fx_rate, round(base(x), 2), x.scope, who(x.charged_to), who(x.paid_by), x.recurring_id ? 'yes' : '', x.excluded ? 'yes' : '']),
  ];

  const setup: Cell[][] = [['Property', 'Kind', 'Rule_From', 'Commission_Rate', 'Party', 'Revenue_Share', 'Expense_Share']];
  for (const rule of data.rules)
    for (const share of rule.shares)
      setup.push([name(rule.property_id), property.get(rule.property_id)?.kind ?? '', rule.effective_from, rule.commission_rate, who(share.party_id), share.revenue, share.expense]);

  const recurring: Cell[][] = [
    ['Property', 'Category', 'Vendor', 'Description', 'Currency', 'Amount', 'Day', 'Start_Month', 'End_Month', 'Scope'],
    ...data.recurring.map((r): Cell[] => [name(r.property_id), r.category, r.vendor, r.description, r.currency, r.amount, r.day, r.start_month, r.end_month, r.scope]),
  ];

  const transfers: Cell[][] = [
    ['Property', 'Date', 'From', 'To', `Amount_${cur}`, 'Note'],
    ...data.transfers.map((t): Cell[] => [name(t.property_id), t.date, t.from_party ? who(t.from_party) : 'Property cash', t.to_party ? who(t.to_party) : 'Property cash', t.amount, t.note]),
  ];

  const dashboard: Cell[][] = [['Property', 'Month', `Net_Revenue_${cur}`, `Total_Expenses_${cur}`, 'Net', 'Cumulative_Net', 'Nights', 'Rent_Covered', 'For_Me']];
  for (const p of data.properties) {
    const span = dataSpan(data, p.id);
    if (!span) continue;
    for (const pt of series(data, p.id, monthRange(span.first, span.last)))
      dashboard.push([p.name, pt.month, round(pt.revenue), round(pt.expenses), round(pt.net), round(pt.cumulative), pt.nights, pt.rentCovered === null ? '' : pt.rentCovered ? 'YES' : 'NO', round(pt.mine)]);
  }

  return writeWorkbook([
    { name: 'Setup', rows: setup },
    { name: 'Revenue_Entries', rows: revenue },
    { name: 'Expense_Entries', rows: expenses },
    { name: 'Recurring', rows: recurring },
    { name: 'Transfers', rows: transfers },
    { name: 'Monthly_Dashboard', rows: dashboard },
  ]);
}
