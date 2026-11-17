/**
 * In-memory backend with invented sample data.
 * Nothing leaves the device and nothing survives a restart.
 */
import { addDays, addMonths, currentMonth, dateInMonth, daysInMonth, monthOf, monthRange } from '@/core/dates';
import { newId, now } from '@/core/id';
import { type Booking, type Data, type Expense, emptyData } from '@/core/types';

import { AiUnavailable, type Backend, type PublishedStatement, type Session, type Table } from './backend';

/** Small deterministic generator, so the demo looks the same on every launch. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function sampleData(): Data {
  const d = emptyData();
  d.profile.name = 'Khady';
  const rand = seeded(7);
  const created = now();
  const months = monthRange(addMonths(currentMonth(), -7), currentMonth());

  const studio = { id: newId(), me: newId(), other: newId() };
  const villa = { id: newId(), me: newId(), other: newId() };

  d.properties.push(
    { id: studio.id, name: 'Studio Mermoz', location: 'Dakar', kind: 'partnership', color: 'indigo', revenue_basis: 'checkin', payout_party_id: null, deposit: 400000, notes: 'Caution de 400 000 F (200 000 F chacune), en plus des apports. Bail de 2 ans.', archived: false, created_at: created },
    { id: villa.id, name: 'Villa Ngor', location: 'Dakar', kind: 'managed', color: 'lagoon', revenue_basis: 'checkin', payout_party_id: null, deposit: 0, notes: '', archived: false, created_at: created },
  );
  d.parties.push(
    { id: studio.me, property_id: studio.id, name: 'Khady', is_me: true },
    { id: studio.other, property_id: studio.id, name: 'Awa', is_me: false },
    { id: villa.me, property_id: villa.id, name: 'Khady', is_me: true },
    { id: villa.other, property_id: villa.id, name: 'M. Diop', is_me: false },
  );
  d.rules.push(
    { id: newId(), property_id: studio.id, effective_from: months[0], commission_rate: 0, shares: [{ party_id: studio.me, revenue: 0.6, expense: 0.6 }, { party_id: studio.other, revenue: 0.4, expense: 0.4 }] },
    { id: newId(), property_id: villa.id, effective_from: months[0], commission_rate: 0.13, shares: [{ party_id: villa.me, revenue: 0, expense: 0 }, { party_id: villa.other, revenue: 1, expense: 1 }] },
  );

  const booking = (property_id: string, check_in: string, nights: number, perNight: number): Booking => {
    const platform = ['Airbnb', 'Booking', 'Airbnb', 'Direct', 'Airbnb'][d.bookings.length % 5];
    const eur = platform === 'Airbnb' && rand() > 0.4;
    const xof = Math.round((nights * perNight) / 10) * 10;
    return {
      id: newId(), property_id, platform, guest: '', check_in, check_out: addDays(check_in, nights),
      received_on: addDays(check_in, 1), currency: eur ? 'EUR' : 'XOF',
      amount: eur ? Math.round((xof / 655.957) * 100) / 100 : xof, fx_rate: eur ? 655.957 : 1,
      commission_rate: null, received_by: null, notes: '', created_at: created,
    };
  };
  const expense = (property_id: string | null, date: string, category: string, vendor: string, description: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
    id: newId(), property_id, date, month: monthOf(date), category, vendor, description, currency: 'XOF', amount, fx_rate: 1,
    scope: 'property', charged_to: null, paid_by: null, recurring_id: null, excluded: false, created_at: created, ...extra,
  });

  const rentId = newId();
  const netId = newId();
  d.recurring.push(
    { id: rentId, property_id: studio.id, category: 'rent', vendor: 'M. Ndiaye', description: 'Loyer', currency: 'XOF', amount: 350000, fx_rate: 1, scope: 'property', paid_by: null, day: 1, start_month: months[0], end_month: null, created_at: created },
    { id: netId, property_id: studio.id, category: 'internet', vendor: 'Orange', description: 'Pass illimité', currency: 'XOF', amount: 17900, fx_rate: 1, scope: 'property', paid_by: null, day: 5, start_month: months[0], end_month: null, created_at: created },
  );

  months.forEach((month, index) => {
    const last = index === months.length - 1;
    for (const [p, perNight] of [[studio, 26000], [villa, 62000]] as const) {
      let day = 1 + Math.floor(rand() * 4);
      const limit = last ? Math.min(daysInMonth(month), new Date().getDate() + 6) : daysInMonth(month);
      while (day < limit - 1) {
        const nights = 1 + Math.floor(rand() * 6);
        d.bookings.push(booking(p.id, dateInMonth(month, day), Math.min(nights, limit - day), perNight * (0.85 + rand() * 0.4)));
        day += nights + Math.floor(rand() * 5);
      }
    }
    d.expenses.push(
      expense(studio.id, dateInMonth(month, 1), 'rent', 'M. Ndiaye', 'Loyer', 350000, { recurring_id: rentId }),
      expense(studio.id, dateInMonth(month, 5), 'internet', 'Orange', 'Pass illimité', 17900, { recurring_id: netId }),
      expense(studio.id, dateInMonth(month, 3), 'electricity', 'Woyofal', 'Recharge', index === months.length - 2 ? 61000 : 20000 + Math.round(rand() * 12) * 1000),
      expense(studio.id, dateInMonth(month, 12), 'cleaning', 'Diarra', 'Ménage', 10000),
      expense(studio.id, dateInMonth(month, 20), 'supplies', 'Exclusive', 'Lessive et kit de bienvenue', 6000 + Math.round(rand() * 9) * 1000),
      expense(villa.id, dateInMonth(month, 8), 'cleaning', 'DKR Services', 'Ménage après départ', 22000),
      expense(villa.id, dateInMonth(month, 15), 'maintenance', 'Modou plombier', 'Entretien piscine', 35000),
      expense(villa.id, dateInMonth(month, 16), 'transport', '', 'Mes déplacements', 9000, { scope: 'private' }),
    );
  });
  d.expenses.push(expense(null, dateInMonth(currentMonth(), 2), 'other', 'Canva', 'Abonnement photos annonces', 8500, { scope: 'private' }));
  // What it cost to get the studio ready, paid out of the two partners' contributions.
  d.expenses.push(
    expense(studio.id, dateInMonth(months[0], 2), 'equipment', 'Orca', 'Lit, canapé et rangements', 420000, { scope: 'setup' }),
    expense(studio.id, dateInMonth(months[0], 3), 'equipment', 'ElectroMénager Dakar', 'Machine à laver et frigo', 310000, { scope: 'setup' }),
    expense(studio.id, dateInMonth(months[0], 6), 'supplies', 'Marché HLM', 'Draps, serviettes et vaisselle', 95000, { scope: 'setup' }),
  );
  d.transfers.push({ id: newId(), property_id: studio.id, date: dateInMonth(months[0], 4), from_party: studio.other, to_party: null, amount: 400000, note: 'Apport de départ', created_at: created });
  d.transfers.push({ id: newId(), property_id: studio.id, date: dateInMonth(months[0], 1), from_party: studio.me, to_party: null, amount: 600000, note: 'Apport de départ', created_at: created });
  return d;
}

export function createDemoBackend(): Backend {
  let data = sampleData();
  const files = new Map<string, string>();
  const published = new Map<string, PublishedStatement>();
  const session: Session = { userId: 'demo', email: 'demo@stayfolio.app' };

  const tableOf = (t: Table) => data[t] as { id: string }[];

  return {
    demo: true,
    getSession: async () => session,
    onAuthChange: () => () => {},
    sendSignInLink: async () => {},
    signIn: async () => {},
    signUp: async () => false,
    sendPasswordReset: async () => {},
    updatePassword: async () => {},
    signOut: async () => {
      data = sampleData();
    },
    deleteAccount: async () => {},

    load: async () => structuredCloneSafe(data),
    saveProfile: async (profile) => {
      data.profile = profile;
    },
    upsert: async (table, rows) => {
      const list = tableOf(table);
      for (const row of rows as { id: string }[]) {
        const i = list.findIndex((r) => r.id === row.id);
        if (i >= 0) list[i] = row;
        else list.push(row);
      }
    },
    remove: async (table, ids) => {
      (data[table] as { id: string }[]) = tableOf(table).filter((r) => !ids.includes(r.id));
      // Mimic the database's cascades.
      if (table === 'properties') {
        for (const t of ['parties', 'rules', 'bookings', 'expenses', 'recurring', 'transfers', 'docs', 'shares'] as const)
          (data[t] as { property_id: string | null }[]) = (data[t] as { property_id: string | null }[]).filter(
            (r) => !r.property_id || !ids.includes(r.property_id),
          );
      }
      if (table === 'recurring')
        data.expenses = data.expenses.map((x) => (x.recurring_id && ids.includes(x.recurring_id) ? { ...x, recurring_id: null } : x));
    },

    uploadFile: async (path, bytes, mime) => {
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      files.set(path, `data:${mime};base64,${globalThis.btoa(binary)}`);
    },
    fileUrl: async (path) => files.get(path) ?? '',
    removeFiles: async (paths) => paths.forEach((p) => files.delete(p)),

    publishShare: async (share, payload) => {
      const link = { ...share, token: newId().replace(/-/g, ''), created_at: now(), revoked: false };
      published.set(link.token, { title: share.title, created_at: link.created_at, statement: payload });
      data.shares.push(link);
      return link;
    },
    revokeShares: async (ids) => {
      data.shares = data.shares.map((s) => (ids.includes(s.id) ? { ...s, revoked: true } : s));
    },
    fetchShared: async (token) => {
      const link = data.shares.find((s) => s.token === token);
      return link && !link.revoked ? (published.get(token) ?? null) : null;
    },

    readReceipt: async () => {
      throw new AiUnavailable('demo');
    },
    ask: async () => {
      throw new AiUnavailable('demo');
    },
  };
}

const structuredCloneSafe = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
