/**
 * Imports the "Airbnb Tracker" Excel workbook (sheets Setup, Revenue_Entries,
 * Expense_Entries, Monthly_Dashboard) into one property.
 *
 * Columns are located by their header text, so reordering columns or adding
 * new ones in the workbook does not break the import.
 */
import { addMonths, excelSerialToISO, isISODate, monthOf } from './dates';
import { newId, now } from './id';
import type { Booking, Expense, ID, Month, Party, Property, Recurring, Rule, Transfer } from './types';
import { type Cell, type Workbook, readWorkbook, toRows } from './xlsx';

export interface ImportPlan {
  property: Property;
  parties: Party[];
  rule: Rule;
  bookings: Booking[];
  expenses: Expense[];
  transfers: Transfer[];
  /** Proposed recurring expenses (rent), starting after the last imported month. */
  recurring: Recurring[];
  /** Default rates found in the workbook, e.g. { EUR: 655.957 }. */
  fx: Record<string, number>;
  /**
   * Expenses that look like set-up costs: everything spent in the first month
   * except the rent. The user decides whether to import them as such
   * (`withSetup`).
   */
  setupIds: ID[];
  /** Monthly figures from the workbook's own dashboard, to check the import against. */
  dashboard: { month: Month; revenue: number; expenses: number }[];
  warnings: string[];
}

const CATEGORY: Record<string, string> = {
  rent: 'rent',
  loyer: 'rent',
  cleaning: 'cleaning',
  menage: 'cleaning',
  appliances: 'equipment',
  electricite: 'electricity',
  electricity: 'electricity',
  internet: 'internet',
  maintenance: 'maintenance',
  supplies: 'supplies',
  taxes: 'taxes',
  transport: 'transport',
  water: 'water',
  eau: 'water',
  other: 'other',
};

const norm = (v: Cell) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const num = (v: Cell): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: Cell): string => (v === null || v === undefined ? '' : String(v).trim());

/** Dates come as Excel serial numbers, or sometimes as text. */
function date(v: Cell): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) return excelSerialToISO(v);
  if (typeof v === 'string' && isISODate(v.trim().slice(0, 10))) return v.trim().slice(0, 10);
  return null;
}

/** Maps normalised header text to its column index. */
function headers(row: Cell[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  (row ?? []).forEach((v, i) => {
    const key = norm(v);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

const findSheet = (book: Workbook, ...names: string[]) => {
  const wanted = names.map((n) => n.toLowerCase());
  const key = Object.keys(book).find((k) => wanted.includes(k.toLowerCase()));
  return key ? toRows(book[key]) : null;
};

export function looksLikeTracker(book: Workbook): boolean {
  return !!findSheet(book, 'Revenue_Entries') && !!findSheet(book, 'Expense_Entries');
}

export function planImport(bytes: Uint8Array, fileName = ''): ImportPlan {
  const book = readWorkbook(bytes);
  const warnings: string[] = [];
  const revenue = findSheet(book, 'Revenue_Entries');
  const spend = findSheet(book, 'Expense_Entries');
  if (!revenue || !spend) throw new Error('unknown_workbook');

  // --- Setup: label in column A, value in column B -------------------------
  const setup = new Map<string, Cell>();
  for (const row of findSheet(book, 'Setup') ?? []) if (row[0]) setup.set(norm(row[0]), row[1]);
  const setupValue = (...needles: string[]) => {
    for (const [label, value] of setup) if (needles.every((n) => label.includes(n))) return value;
    return null;
  };
  const nameA = str(setupValue('investor a', 'name')) || 'Moi';
  const nameB = str(setupValue('investor b', 'name'));
  const eurRate = num(setupValue('fx')) ?? 655.957;
  const rent = num(setupValue('rent'));

  const propertyId = newId();
  const created = now();
  const me: Party = { id: newId(), property_id: propertyId, name: nameA, is_me: true };
  const parties: Party[] = [me];
  // The workbook's "Revenue Split" (60/40 in the original) is how the partners
  // share what the property earns once its running costs are paid, so it
  // applies to income and expenses alike. Its "Expense Split" (50/50) is how
  // they funded the place: what each put in is imported below as payments.
  const splitA = num(setupValue('revenue split a')) ?? 1;
  const splitB = num(setupValue('revenue split b')) ?? 0;
  const shares = [{ party_id: me.id, revenue: splitA, expense: splitA }];
  let partner: Party | null = null;
  if (nameB) {
    partner = { id: newId(), property_id: propertyId, name: nameB, is_me: false };
    parties.push(partner);
    shares.push({ party_id: partner.id, revenue: splitB, expense: splitB });
  }

  const property: Property = {
    id: propertyId,
    name: fileName.replace(/\.xlsx?$/i, '').replace(/[_-]+/g, ' ').trim() || 'Mon bien',
    location: '',
    kind: partner ? 'partnership' : 'owned',
    color: 'indigo',
    revenue_basis: 'checkin',
    payout_party_id: null,
    deposit: 0,
    notes: '',
    archived: false,
    created_at: created,
  };

  const fxOf = (currency: string, amount: number, baseAmount: number | null) => {
    // When the sheet holds a converted amount, trust it: the effective rate
    // also captures manual tweaks such as "=G22*H22+1625".
    if (baseAmount !== null && amount) return baseAmount / amount;
    return currency === 'EUR' ? eurRate : 1;
  };

  // --- Revenue -------------------------------------------------------------
  const rh = headers(revenue[0]);
  const rc = (name: string) => rh.get(name) ?? -1;
  const bookings: Booking[] = [];
  revenue.slice(1).forEach((row, i) => {
    const amount = num(row[rc('net_payout')]);
    if (!amount) return;
    const checkIn = date(row[rc('checkin')]) ?? date(row[rc('date_received')]);
    if (!checkIn) {
      warnings.push(`Revenue_Entries, ligne ${i + 2} : date d'arrivée manquante, ligne ignorée.`);
      return;
    }
    const currency = str(row[rc('currency')]).toUpperCase() || 'XOF';
    const platform = str(row[rc('platform')]) || 'Direct';
    bookings.push({
      id: newId(),
      property_id: propertyId,
      platform: platform === 'Other' ? 'Direct' : platform,
      guest: '',
      check_in: checkIn,
      check_out: date(row[rc('checkout')]),
      received_on: date(row[rc('date_received')]),
      currency,
      amount,
      fx_rate: fxOf(currency, amount, num(row[rc('net_payout_xof')])),
      commission_rate: null,
      received_by: null,
      notes: str(row[rc('notes')]),
      created_at: created,
    });
  });

  // --- Expenses ------------------------------------------------------------
  const eh = headers(spend[0]);
  const ec = (name: string) => eh.get(name) ?? -1;
  const expenses: Expense[] = [];
  const transfers: Transfer[] = [];
  let lastDate: string | null = null;
  spend.slice(1).forEach((row) => {
    const d = date(row[ec('date')]);
    if (d) lastDate = d;
    const amount = num(row[ec('amount')]);
    if (d && amount) {
      const currency = str(row[ec('currency')]).toUpperCase() || 'XOF';
      const rawCategory = norm(row[ec('category')]);
      const description = str(row[ec('description')]);
      const vendor = str(row[ec('vendor')]);
      // The workbook has no "water" category: water bills were filed under "Other".
      const isWater = rawCategory === 'other' && (/\beau\b/i.test(description) || /sen.?eau/i.test(vendor));
      const category = isWater ? 'water' : CATEGORY[rawCategory];
      expenses.push({
        id: newId(),
        property_id: propertyId,
        date: d,
        month: monthOf(date(row[ec('month')]) ?? d),
        category: category ?? 'other',
        vendor,
        description,
        currency,
        amount,
        fx_rate: fxOf(currency, amount, num(row[ec('amount_xof')])),
        scope: 'property',
        charged_to: null,
        paid_by: null,
        recurring_id: null,
        excluded: false,
        created_at: created,
      });
    }
    // "Paid investor B": money the partner put in, listed alongside the rows.
    const paidB = num(row[ec('paid investor b')]);
    if (partner && paidB) {
      transfers.push({
        id: newId(),
        property_id: propertyId,
        date: d ?? lastDate ?? created.slice(0, 10),
        from_party: partner.id,
        to_party: null,
        amount: paidB,
        note: 'Repris du classeur Excel',
        created_at: created,
      });
    }
  });

  if (!bookings.length && !expenses.length) throw new Error('empty_workbook');

  const first = [...bookings.map((b) => monthOf(b.check_in)), ...expenses.map((x) => x.month)].sort()[0];
  const rule: Rule = {
    id: newId(),
    property_id: propertyId,
    effective_from: first,
    commission_rate: 0,
    shares,
  };

  const setupIds = expenses.filter((x) => x.month === first && x.category !== 'rent').map((x) => x.id);

  // --- Rent becomes a recurring expense from the month after the last one --
  const recurring: Recurring[] = [];
  const rents = expenses.filter((x) => x.category === 'rent').sort((a, b) => a.month.localeCompare(b.month));
  if (rents.length >= 2) {
    const last = rents[rents.length - 1];
    recurring.push({
      id: newId(),
      property_id: propertyId,
      category: 'rent',
      vendor: last.vendor,
      description: 'Loyer',
      currency: last.currency,
      amount: rent ?? last.amount,
      fx_rate: last.fx_rate,
      scope: 'property',
      paid_by: null,
      day: 1,
      start_month: addMonths(last.month, 1),
      end_month: null,
      created_at: created,
    });
  }

  // --- The workbook's own monthly dashboard, kept to verify the import -----
  const dashboard: ImportPlan['dashboard'] = [];
  const dash = findSheet(book, 'Monthly_Dashboard');
  if (dash) {
    const dh = headers(dash[0]);
    for (const row of dash.slice(1)) {
      const d = date(row[dh.get('month') ?? 0]);
      const rev = num(row[dh.get('net_revenue_xof') ?? 1]) ?? 0;
      const exp = num(row[dh.get('total_expenses_xof') ?? 2]) ?? 0;
      if (d && (rev || exp)) dashboard.push({ month: monthOf(d), revenue: rev, expenses: exp });
    }
  }

  return {
    property,
    parties,
    rule,
    bookings,
    expenses,
    transfers,
    recurring,
    fx: { EUR: eurRate },
    setupIds,
    dashboard,
    warnings,
  };
}

/** The plan with its first-month expenses (rent aside) counted as set-up costs. */
export const withSetup = (plan: ImportPlan): ImportPlan => ({
  ...plan,
  expenses: plan.expenses.map((x) => (plan.setupIds.includes(x.id) ? { ...x, scope: 'setup' } : x)),
});
