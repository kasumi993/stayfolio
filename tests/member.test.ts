import { describe, expect, it } from 'vitest';

import { balances, treasury } from '../src/core/calc';
import { memberView } from '../src/core/member';
import { type Data, type Member, emptyData } from '../src/core/types';

/** A shared studio and a second property the member must never see. */
function setup(): { data: Data; member: Member } {
  const d = emptyData();
  d.profile.name = 'Khady';
  const created = '2026-01-01T00:00:00Z';
  d.properties = [
    { id: 'p1', name: 'Studio', location: '', kind: 'partnership', color: 'indigo', revenue_basis: 'checkin', payout_party_id: null, deposit: 900000, notes: 'secret', archived: false, created_at: created },
    { id: 'p2', name: 'Villa', location: '', kind: 'managed', color: 'lagoon', revenue_basis: 'checkin', payout_party_id: null, deposit: 0, notes: '', archived: false, created_at: created },
  ];
  d.parties = [
    { id: 'me', property_id: 'p1', name: 'Moi', is_me: true },
    { id: 'awa', property_id: 'p1', name: 'Awa', is_me: false },
    { id: 'me2', property_id: 'p2', name: 'Moi', is_me: true },
  ];
  d.rules = [{ id: 'r1', property_id: 'p1', effective_from: '2026-01', commission_rate: 0, shares: [{ party_id: 'me', revenue: 0.6, expense: 0.6 }, { party_id: 'awa', revenue: 0.4, expense: 0.4 }] }];
  const booking = { platform: 'Airbnb', guest: '', check_out: null, received_on: null, currency: 'XOF', fx_rate: 1, commission_rate: null, received_by: null, notes: '', created_at: created };
  d.bookings = [
    { ...booking, id: 'b1', property_id: 'p1', check_in: '2026-02-03', amount: 100000 },
    { ...booking, id: 'b2', property_id: 'p2', check_in: '2026-02-03', amount: 50000 },
  ];
  const expense = { month: '2026-02', category: 'other', vendor: '', description: '', currency: 'XOF', fx_rate: 1, charged_to: null, paid_by: null, recurring_id: null, excluded: false, created_at: created };
  d.expenses = [
    { ...expense, id: 'x1', property_id: 'p1', date: '2026-02-04', amount: 20000, scope: 'property' },
    { ...expense, id: 'x2', property_id: 'p1', date: '2026-02-05', amount: 5000, scope: 'private' },
    { ...expense, id: 'x3', property_id: 'p2', date: '2026-02-05', amount: 7000, scope: 'property' },
  ];
  d.transfers = [{ id: 't1', property_id: 'p1', date: '2026-01-02', from_party: 'awa', to_party: null, amount: 300000, note: '', created_at: created }];
  const doc = { booking_id: null, name: 'f.pdf', mime: 'application/pdf', size: 1, title: '', date: null, amount: null, created_at: created };
  d.docs = [
    { ...doc, id: 'd1', property_id: 'p1', expense_id: 'x1', path: 'a' },
    { ...doc, id: 'd2', property_id: 'p1', expense_id: 'x2', path: 'b' },
    { ...doc, id: 'd3', property_id: 'p1', expense_id: null, path: 'c' },
  ];
  const member: Member = { id: 'm1', property_id: 'p1', name: 'Awa', email: '', token: 't'.repeat(48), can_edit: false, pages: ['income', 'expenses', 'invoices', 'report', 'cash'], monthly_report: false, last_seen_at: null, created_at: created };
  return { data: d, member };
}

describe('member view', () => {
  it('shows one property, without its notes, deposit or private expenses', () => {
    const { data, member } = setup();
    const v = memberView(data, member, 'Khady');
    expect(v.properties.map((p) => p.id)).toEqual(['p1']);
    expect(v.properties[0].notes).toBe('');
    expect(v.properties[0].deposit).toBe(0);
    expect(v.expenses.map((x) => x.id)).toEqual(['x1']);
    expect(v.bookings.map((b) => b.id)).toEqual(['b1']);
    // An invoice of a private expense stays hidden; a loose one is shown.
    expect(v.docs.map((d) => d.id).sort()).toEqual(['d1', 'd3']);
    expect(v.recurring).toEqual([]);
    expect(v.members).toEqual([]);
  });

  it('names the owner’s party after the owner and keeps the figures identical', () => {
    const { data, member } = setup();
    const v = memberView(data, member, 'Khady');
    expect(v.parties.find((p) => p.is_me)?.name).toBe('Khady');
    // Private costs never reach the shared books, so balances and cash match the owner's.
    expect(treasury(v, 'p1')).toBe(treasury(data, 'p1'));
    expect(balances(v, 'p1').map((b) => Math.round(b.balance))).toEqual(balances(data, 'p1').map((b) => Math.round(b.balance)));
  });

  it('gives only the pages allowed', () => {
    const { data, member } = setup();
    const v = memberView(data, { ...member, pages: ['income'] }, 'Khady');
    expect(v.bookings).toHaveLength(1);
    expect(v.expenses).toHaveLength(0);
    expect(v.docs).toHaveLength(0);
    expect(v.transfers).toHaveLength(0);
    expect(v.rules).toHaveLength(0);
  });
});
