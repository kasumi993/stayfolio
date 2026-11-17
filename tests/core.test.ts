import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { balances, monthStatement, occupancy, payback, propertyStatement, series, statement, treasury } from '../src/core/calc';
import { addMonths, dateInMonth, diffDays, excelSerialToISO, monthRange } from '../src/core/dates';
import { planImport, withSetup } from '../src/core/importWorkbook';
import { evalAmount, formatMoney, formatNumber } from '../src/core/money';
import { dueOccurrences } from '../src/core/recurring';
import { buildSharedStatement } from '../src/core/sharing';
import { type Data, emptyData } from '../src/core/types';
import { readWorkbook, toRows, writeWorkbook } from '../src/core/xlsx';

const sample = process.env.STAYFOLIO_SAMPLE_XLSX ?? '';

/** A managed property: the owner gets everything minus my 13 % commission. */
function managed(): Data {
  const d = emptyData();
  d.properties.push({ id: 'p', name: 'Villa', location: '', kind: 'managed', color: 'indigo', revenue_basis: 'checkin', payout_party_id: null, deposit: 0, notes: '', archived: false, created_at: '' });
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
    expect(formatNumber(1234567.4)).toBe('1\u00a0234\u00a0567');
    expect(formatMoney(-450000, 'XOF')).toBe('−450\u00a0000 F');
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

  it('counts occupancy night by night, splitting stays across months', () => {
    const d = managed();
    // 4 + 2 nights in March out of 31.
    expect(occupancy(d, 'p', ['2026-03'])).toMatchObject({ booked: 6, available: 31 });
    d.bookings.push({ ...d.bookings[0], id: 'b9', check_in: '2026-03-30', check_out: '2026-04-03' });
    expect(occupancy(d, 'p', ['2026-03']).booked).toBe(8);
    expect(occupancy(d, 'p', ['2026-04']).booked).toBe(2);
    expect(occupancy(d, null, ['2026-03', '2026-04']).available).toBe(61);
  });

  it('tells how far a property is from paying back its set-up', () => {
    const d = managed();
    d.bookings = [];
    d.expenses = [];
    const b = { ...managed().bookings[0], commission_rate: 0 };
    const x = { ...managed().expenses[0] };
    // January: 900 000 of set-up. February to April: +100 000 a month. May is in progress.
    d.expenses.push({ ...x, id: 'setup', date: '2026-01-05', month: '2026-01', amount: 900000 });
    ['02', '03', '04'].forEach((m) => d.bookings.push({ ...b, id: 'b' + m, check_in: `2026-${m}-03`, check_out: `2026-${m}-05`, amount: 100000 }));
    d.expenses.push({ ...x, id: 'may', date: '2026-05-01', month: '2026-05', amount: 40000 });
    const p = payback(d, 'p', '2026-05')!;
    expect(p.invested).toBe(900000);
    expect(p.cumulative).toBe(-640000);
    expect(p.paceMonths).toBe(3);
    expect(p.pace).toBe(100000);
    expect(p.monthsLeft).toBe(6);
    // A property that only breaks even never gets there.
    d.bookings.forEach((row) => (row.amount = 0));
    expect(payback(d, 'p', '2026-05')!.monthsLeft).toBeNull();
    expect(payback(emptyData(), 'p', '2026-05')).toBeNull();
  });

  it('keeps set-up costs out of the result, but not out of what is left to recover', () => {
    const d = managed();
    d.properties[0].kind = 'partnership';
    d.rules[0] = { ...d.rules[0], commission_rate: 0, shares: [{ party_id: 'me', revenue: 0.6, expense: 0.6 }, { party_id: 'ow', revenue: 0.4, expense: 0.4 }] };
    d.bookings.forEach((b) => (b.commission_rate = null));
    d.expenses.push({ ...d.expenses[0], id: 'kit', category: 'equipment', amount: 500000, scope: 'setup' });
    d.transfers.push({ id: 't1', property_id: 'p', date: '2026-03-01', from_party: 'ow', to_party: 'me', amount: 250000, note: '', created_at: '' });
    const s = monthStatement(d, 'p', '2026-03');
    expect([s.revenue, s.expenses, s.setup, s.net]).toEqual([150000, 10000, 500000, 140000]);
    expect(s.byCategory.equipment).toBeUndefined();
    expect(s.parties.map((l) => l.net)).toEqual([84000, 56000]);
    expect(series(d, 'p', ['2026-03'])[0].cumulative).toBe(-360000);
    // What she put in is not profit paid out: her 40 % is still due in full.
    const partner = balances(d, 'p').find((b) => !b.party.is_me)!;
    expect(partner.undistributed).toBe(56000);
    d.transfers.push({ id: 't2', property_id: 'p', date: '2026-03-31', from_party: 'me', to_party: 'ow', amount: 50000, note: '', created_at: '' });
    expect(balances(d, 'p').find((b) => !b.party.is_me)!.undistributed).toBe(6000);
    // I put 300 000 in myself and take 20 000 of profit out: both go through the property's cash.
    d.transfers.push({ id: 't3', property_id: 'p', date: '2026-03-01', from_party: 'me', to_party: null, amount: 300000, note: '', created_at: '' });
    d.transfers.push({ id: 't4', property_id: 'p', date: '2026-03-31', from_party: null, to_party: 'me', amount: 20000, note: '', created_at: '' });
    const [mine, hers] = ['me', 'ow'].map((id) => balances(d, 'p').find((b) => b.party.id === id)!);
    expect([mine.contributed, mine.drawn, mine.undistributed]).toEqual([300000, 20000, 64000]);
    expect([hers.contributed, hers.drawn]).toEqual([250000, 50000]);
    // Cash: 550 000 put in + 150 000 earned − 10 000 running − 500 000 set-up − 70 000 paid out.
    expect(treasury(d, 'p')).toBe(120000);
    // A partner's statement lists the set-up costs apart from the running ones.
    const shared = buildSharedStatement(d, 'p', 'ow', ['2026-03'], { showCommission: true });
    expect(shared.setup).toHaveLength(1);
    expect(shared.expenses).toHaveLength(1);
    expect(shared.totals.expenses).toBe(10000);
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
    // What the place earns is shared 60/40; the workbook's 50/50 is how it was funded.
    expect(plan.rule.shares.map((s) => [s.revenue, s.expense])).toEqual([[0.6, 0.6], [0.4, 0.4]]);
    // The first month's purchases, rent aside, are proposed as set-up costs.
    expect(plan.setupIds).toHaveLength(18);
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
    // With the first month's purchases counted as set-up costs, the profit to
    // share leaves them aside, and what is left to recover still counts them.
    const tagged = withSetup(plan);
    const e: Data = { ...d, expenses: tagged.expenses };
    const s = propertyStatement(e, plan.property, () => true);
    expect(Math.round(s.setup)).toBe(1599806);
    expect(s.net - s.setup).toBeCloseTo(-1825683.757, 2);
    expect(s.parties.map((l) => Math.round(l.net))).toEqual([-135527, -90351]);
    expect(monthStatement(e, plan.property.id, '2026-04').expenses).toBe(450000);
    const partner = balances(e, plan.property.id).find((b) => !b.party.is_me)!;
    expect(partner.contributed).toBe(1208000);
    expect(Math.round(treasury(e, plan.property.id))).toBe(1208000 - 1825684);
    expect(Math.round(partner.undistributed)).toBe(-90351);
    expect(series(e, plan.property.id, monthRange('2026-04', '2026-11'))[7].cumulative).toBeCloseTo(-1825683.757, 2);
    const q = payback(e, plan.property.id, '2026-11')!;
    expect([Math.round(q.setup), Math.round(q.profit), q.monthsLeft]).toEqual([1599806, -225878, 52]);
    const p = payback(d, plan.property.id, '2026-11')!;
    expect(Math.round(p.cumulative)).toBe(-1825684);
    expect(p.paceMonths).toBe(6);
    expect(p.monthsLeft).toBe(52);
  });
});
