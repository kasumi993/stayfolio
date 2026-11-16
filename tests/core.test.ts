import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { balances, monthStatement, propertyStatement, series, statement } from '../src/core/calc';
import { addMonths, dateInMonth, diffDays, excelSerialToISO, monthRange } from '../src/core/dates';
import { planImport } from '../src/core/importWorkbook';
import { evalAmount, formatMoney, formatNumber } from '../src/core/money';
import { dueOccurrences } from '../src/core/recurring';
import { buildSharedStatement } from '../src/core/sharing';
import { type Data, emptyData } from '../src/core/types';
import { readWorkbook, toRows, writeWorkbook } from '../src/core/xlsx';

const sample = process.env.STAYFOLIO_SAMPLE_XLSX ?? '';

/** A managed property: the owner gets everything minus my 13 % commission. */
function managed(): Data {
  const d = emptyData();
  d.properties.push({ id: 'p', name: 'Villa', location: '', kind: 'managed', color: 'indigo', revenue_basis: 'checkin', payout_party_id: null, archived: false, created_at: '' });
  d.parties.push({ id: 'me', property_id: 'p', name: 'Moi', is_me: true }, { id: 'ow', property_id: 'p', name: 'Awa', is_me: false });
  d.rules.push({ id: 'r', property_id: 'p', effective_from: '2026-01', commission_rate: 0.13, shares: [{ party_id: 'ow', revenue: 1, expense: 1 }, { party_id: 'me', revenue: 0, expense: 0 }] });
  const b = { property_id: 'p', platform: 'Airbnb', guest: '', received_on: null, currency: 'XOF', fx_rate: 1, commission_rate: null, received_by: null, notes: '', created_at: '' };
  d.bookings.push({ ...b, id: 'b1', check_in: '2026-03-02', check_out: '2026-03-06', amount: 100000 }, { ...b, id: 'b2', check_in: '2026-03-10', check_out: '2026-03-12', amount: 50000, commission_rate: 0.2 });
  const x = { property_id: 'p', vendor: '', description: '', currency: 'XOF', fx_rate: 1, charged_to: null, paid_by: null, recurring_id: null, excluded: false, created_at: '' };
  d.expenses.push(
    { ...x, id: 'x1', date: '2026-03-03', month: '2026-03', category: 'cleaning', amount: 10000, scope: 'property' },
    { ...x, id: 'x2', date: '2026-03-04', month: '2026-03', category: 'transport', amount: 3000, scope: 'private' },
    { ...x, id: 'x3', date: '2026-03-05', month: '2026-03', category: 'internet', amount: 9000, scope: 'property', excluded: true },
  );
  return d;
}

describe('money', () => {
  it('evaluates sums typed like spreadsheet cells', () => {
    expect(evalAmount('175156+14000')).toBe(189156);
    expect(evalAmount('153,53 + 5 + 5')).toBeCloseTo(163.53);
    expect(evalAmount('=(20000-18000)/2')).toBe(1000);
    expect(evalAmount('450 000')).toBe(450000);
    expect(evalAmount('2×9900')).toBe(19800);
    expect(evalAmount('12abc')).toBeNull();
    expect(evalAmount('')).toBeNull();
    expect(evalAmount('1/0')).toBeNull();
  });
  it('formats amounts', () => {
    expect(formatNumber(1234567.4)).toBe('1 234 567');
    expect(formatMoney(-450000, 'XOF')).toBe('−450 000 F');
    expect(formatMoney(226.9, 'EUR')).toBe('226,90 €');
  });
});

describe('dates', () => {
  it('handles months and days', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(diffDays('2026-04-17', '2026-04-24')).toBe(7);
    expect(dateInMonth('2027-02', 31)).toBe('2027-02-28');
    expect(excelSerialToISO(46129)).toBe('2026-04-17');
  });
});

describe('calc', () => {
  it('computes a managed property with commission, private and excluded rows', () => {
    const d = managed();
    const s = monthStatement(d, 'p', '2026-03');
    expect(s.revenue).toBe(150000);
    expect(s.expenses).toBe(10000);
    expect(s.commission).toBe(13000 + 10000);
    expect(s.privateExpenses).toBe(3000);
    expect(s.nights).toBe(6);
    const owner = s.parties.find((l) => l.party.id === 'ow')!;
    expect(owner.net).toBe(150000 - 23000 - 10000);
    expect(s.mine).toBe(23000 - 3000);
    // I received the payouts and paid the cleaning: I owe the owner their net.
    const bal = balances(d, 'p');
    expect(bal.find((b) => b.party.id === 'ow')!.balance).toBe(117000);
    expect(bal.reduce((t, b) => t + b.balance, 0)).toBeCloseTo(0);
  });

  it('applies rule changes from their effective month only', () => {
    const d = managed();
    d.rules.push({ id: 'r2', property_id: 'p', effective_from: '2026-04', commission_rate: 0.15, shares: d.rules[0].shares });
    d.bookings.push({ ...d.bookings[0], id: 'b3', check_in: '2026-04-01', check_out: '2026-04-02', amount: 100000 });
    expect(monthStatement(d, 'p', '2026-03').commission).toBe(23000);
    expect(monthStatement(d, 'p', '2026-04').commission).toBe(15000);
  });

  it('never leaks private data into a shared statement', () => {
    const d = managed();
    const shared = buildSharedStatement(d, 'p', 'ow', ['2026-03'], { showCommission: true });
    const json = JSON.stringify(shared);
    expect(shared.expenses).toHaveLength(1);
    expect(json).not.toContain('transport');
    expect(shared.totals.due).toBe(117000);
    const hidden = buildSharedStatement(d, 'p', 'ow', ['2026-03'], { showCommission: false });
    expect(hidden.totals.commission).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('23000');
  });

  it('generates recurring expenses once per month and respects the end month', () => {
    const d = managed();
    d.recurring.push({ id: 'rc', property_id: 'p', category: 'rent', vendor: 'Ousmane', description: 'Loyer', currency: 'XOF', amount: 450000, fx_rate: 1, scope: 'property', paid_by: null, day: 1, start_month: '2026-01', end_month: '2026-03', created_at: '' });
    const due = dueOccurrences(d, '2026-05');
    expect(due.map((x) => x.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    d.expenses.push(...due);
    expect(dueOccurrences(d, '2026-05')).toHaveLength(0);
    // Excluding a month keeps the row, so it is not generated again.
    d.expenses.find((x) => x.recurring_id === 'rc' && x.month === '2026-02')!.excluded = true;
    expect(dueOccurrences(d, '2026-05')).toHaveLength(0);
    expect(monthStatement(d, 'p', '2026-02').rent).toBe(0);
    expect(monthStatement(d, 'p', '2026-01').rent).toBe(450000);
  });
});

describe('xlsx', () => {
  it('round-trips a workbook', () => {
    const bytes = writeWorkbook([{ name: 'Feuille & 1', rows: [['Nom', 'Montant'], ['Loyer <mai>', 450000], [null, 12.5]] }]);
    const book = readWorkbook(bytes);
    expect(toRows(book['Feuille & 1'])).toEqual([['Nom', 'Montant'], ['Loyer <mai>', 450000], [null, 12.5]]);
  });
});

/** Parity with the owner's real workbook. Runs only when the file is provided. */
describe.skipIf(!sample || !existsSync(sample))('import of the real workbook', () => {
  const plan = sample && existsSync(sample) ? planImport(new Uint8Array(readFileSync(sample)), 'Tracker.xlsx') : null!;
  const data = (): Data => ({
    ...emptyData(),
    properties: [plan.property],
    parties: plan.parties,
    rules: [plan.rule],
    bookings: plan.bookings,
    expenses: plan.expenses,
    transfers: plan.transfers,
  });

  it('reads every entry', () => {
    expect(plan.bookings).toHaveLength(41);
    expect(plan.expenses).toHaveLength(85);
    expect(plan.parties.map((p) => p.name)).toEqual(['Khady', 'Mareme']);
    expect(plan.rule.shares.map((s) => [s.revenue, s.expense])).toEqual([[0.6, 0.5], [0.4, 0.5]]);
    expect(plan.transfers.reduce((t, x) => t + x.amount, 0)).toBe(1208000);
    expect(plan.recurring[0]).toMatchObject({ category: 'rent', amount: 450000, start_month: '2026-12' });
    expect(plan.warnings).toEqual([]);
  });

  it('matches the Excel dashboard month by month', () => {
    const d = data();
    expect(plan.dashboard).toHaveLength(8);
    for (const row of plan.dashboard) {
      const s = monthStatement(d, plan.property.id, row.month);
      expect(Math.abs(s.revenue - row.revenue), `revenue ${row.month}`).toBeLessThan(1);
      expect(Math.abs(s.expenses - row.expenses), `expenses ${row.month}`).toBeLessThan(1);
    }
  });

  it('matches the Excel totals, nights and cumulative result', () => {
    const d = data();
    const all = statement(d, plan.property.id, () => true);
    expect(all.revenue).toBeCloseTo(4277771.159, 2);
    expect(all.net).toBeCloseTo(-1825683.757, 2);
    const april = monthStatement(d, plan.property.id, '2026-04');
    expect(april.nights).toBe(10);
    expect(april.rentCovered).toBe(false);
    expect(monthStatement(d, plan.property.id, '2026-05').rentCovered).toBe(true);
    const pts = series(d, plan.property.id, monthRange('2026-04', '2026-11'));
    expect(pts[7].cumulative).toBeCloseTo(-1825683.757, 2);
    // Each partner bears half of the expenses, as in columns J and K.
    const s = propertyStatement(d, plan.property, () => true);
    expect(Math.round(s.parties[1].expenses)).toBe(3051727);
  });
});
