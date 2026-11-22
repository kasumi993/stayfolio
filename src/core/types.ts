/**
 * Domain types. Field names match the database columns one-to-one (snake_case),
 * so rows travel between Supabase and the app without a mapping layer.
 */

export type ID = string;
/** Calendar month, `YYYY-MM`. */
export type Month = string;
/** Calendar day, `YYYY-MM-DD`. */
export type ISODate = string;

export type PropertyKind = 'owned' | 'partnership' | 'managed';

export interface Property {
  id: ID;
  name: string;
  location: string;
  /** Only a label used to pick sensible defaults; the maths live in `Rule`. */
  kind: PropertyKind;
  /** Key of a pigment in the theme, gives each property its own colour. */
  color: string;
  /** Which date decides the month a booking counts in. */
  revenue_basis: 'checkin' | 'received';
  /** Party who receives platform payouts by default. null = me. */
  payout_party_id: ID | null;
  /**
   * Security deposit paid to the landlord, all partners together. Paid on top
   * of the contributions and refundable: kept out of every calculation, it is
   * only a reminder.
   */
  deposit: number;
  /** Free notes about the property (terms agreed, who to call…). Never shared. */
  notes: string;
  archived: boolean;
  created_at: string;
}

/** Someone with a stake in a property: me, a partner, or the owner. */
export interface Party {
  id: ID;
  property_id: ID;
  name: string;
  is_me: boolean;
}

export interface Share {
  party_id: ID;
  /** Fraction of the revenue (after my commission) this party receives. 0..1 */
  revenue: number;
  /** Fraction of the property expenses this party bears. 0..1 */
  expense: number;
}

/**
 * The calculation rules of a property from a given month onwards.
 * A property can have several rules over time; the latest one whose
 * `effective_from` is not after the month applies.
 */
export interface Rule {
  id: ID;
  property_id: ID;
  effective_from: Month;
  /** My management fee, as a fraction of each booking payout. 0..1 */
  commission_rate: number;
  shares: Share[];
}

export interface Booking {
  id: ID;
  property_id: ID;
  platform: string;
  guest: string;
  check_in: ISODate;
  check_out: ISODate | null;
  received_on: ISODate | null;
  currency: string;
  /** Net payout in `currency`. */
  amount: number;
  /** Multiplier from `currency` to the account currency. */
  fx_rate: number;
  /** Overrides the rule's commission rate for this booking only. */
  commission_rate: number | null;
  /** Party who received the money. null = me. */
  received_by: ID | null;
  notes: string;
  created_at: string;
}

export type ExpenseScope = 'property' | 'private' | 'setup';

export interface Expense {
  id: ID;
  /** null = a general cost of my activity, tied to no property. */
  property_id: ID | null;
  date: ISODate;
  /** Accounting month. Usually the month of `date`. */
  month: Month;
  category: string;
  vendor: string;
  description: string;
  currency: string;
  amount: number;
  fx_rate: number;
  /**
   * `property`: a running cost of the property, split between parties.
   * `private`: my own professional cost. Never shown to owners or partners.
   * `setup`: what it cost to get the property ready, paid out of what the
   *   partners put in. Kept out of the monthly result and of the profit to
   *   share; counted when asking whether the property has paid for itself.
   */
  scope: ExpenseScope;
  /** Charge the whole expense to one party instead of splitting it. */
  charged_to: ID | null;
  /** Party who paid. null = me. */
  paid_by: ID | null;
  /** Set when this row was generated from a recurring expense. */
  recurring_id: ID | null;
  /** Kept in the ledger but left out of every total (a skipped month). */
  excluded: boolean;
  created_at: string;
}

export interface Recurring {
  id: ID;
  property_id: ID | null;
  category: string;
  vendor: string;
  description: string;
  currency: string;
  amount: number;
  fx_rate: number;
  scope: Exclude<ExpenseScope, 'setup'>;
  paid_by: ID | null;
  /** Day of the month the expense is dated, 1..28. */
  day: number;
  start_month: Month;
  /** Last month generated, inclusive. null = no end. */
  end_month: Month | null;
  created_at: string;
}

/**
 * Money moving on a property. Between two parties (I pay the owner his due),
 * or between a party and the property's own cash: `to_party` null is money
 * put in (a contribution), `from_party` null is money taken out (profit paid
 * to a partner). At least one side is a party.
 */
export interface Transfer {
  id: ID;
  property_id: ID;
  date: ISODate;
  from_party: ID | null;
  to_party: ID | null;
  /** In the account currency. */
  amount: number;
  note: string;
  created_at: string;
}

/** A receipt, invoice or any supporting file. */
export interface Doc {
  id: ID;
  property_id: ID | null;
  expense_id: ID | null;
  booking_id: ID | null;
  /** Path inside the private `documents` storage bucket. */
  path: string;
  /** File name as picked. */
  name: string;
  mime: string;
  size: number;
  /** What the invoice is for, when it stands alone ("Facture Senelec"). */
  title: string;
  /** Date written on the invoice. */
  date: ISODate | null;
  /** Amount written on the invoice, account currency. Informative: only expenses count. */
  amount: number | null;
  created_at: string;
}

/** What a member's link lets them see. */
export type MemberPage = 'income' | 'expenses' | 'invoices' | 'report' | 'cash';
export const MEMBER_PAGES: MemberPage[] = ['income', 'expenses', 'invoices', 'report', 'cash'];

/**
 * Someone the owner shares one property with through a personal link: no
 * account, no password. What they may see or change is enforced by the
 * database functions in supabase/migrations/*_members.sql.
 */
export interface Member {
  id: ID;
  property_id: ID;
  name: string;
  /** Where the monthly report goes, if they get it. Optional. */
  email: string;
  /** Secret part of their link. Set by the database; rotate it to cut an old link. */
  token: string;
  can_edit: boolean;
  pages: MemberPage[];
  monthly_report: boolean;
  last_seen_at: string | null;
  created_at: string;
}

/** A published, read-only statement that an owner or partner can open. */
export interface ShareLink {
  id: ID;
  property_id: ID;
  party_id: ID;
  title: string;
  /** The secret part of the link. Anyone holding it can read the statement. */
  token: string;
  created_at: string;
  revoked: boolean;
}

export interface Profile {
  name: string;
  /** Account currency: every total is expressed in it. */
  currency: string;
  /** Default conversion rates to the account currency, e.g. { EUR: 655.957 }. */
  fx: Record<string, number>;
  locale: 'fr' | 'en';
}

/** Everything the app holds in memory for the signed-in user. */
export interface Data {
  profile: Profile;
  properties: Property[];
  parties: Party[];
  rules: Rule[];
  bookings: Booking[];
  expenses: Expense[];
  recurring: Recurring[];
  transfers: Transfer[];
  docs: Doc[];
  shares: ShareLink[];
  members: Member[];
}

export const emptyData = (): Data => ({
  profile: { name: '', currency: 'XOF', fx: { EUR: 655.957 }, locale: 'fr' },
  properties: [],
  parties: [],
  rules: [],
  bookings: [],
  expenses: [],
  recurring: [],
  transfers: [],
  docs: [],
  shares: [],
  members: [],
});

export const CATEGORIES = [
  'rent',
  'cleaning',
  'electricity',
  'water',
  'internet',
  'supplies',
  'equipment',
  'maintenance',
  'transport',
  'taxes',
  'other',
] as const;

export const PLATFORMS = ['Airbnb', 'Booking', 'Direct'] as const;
