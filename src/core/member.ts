/**
 * What a member's link shows, computed on the device. The database applies
 * the very same rules in `member_load` (supabase/migrations/*_members.sql);
 * this copy serves the demo and the owner's preview, and the tests keep the
 * two in step.
 */
import type { Data, Member } from './types';

export function memberView(data: Data, member: Member, ownerName: string): Data {
  const property = data.properties.find((p) => p.id === member.property_id);
  if (!property) throw new Error('unknown property');
  const has = (page: Member['pages'][number]) => member.pages.includes(page);
  const figures = has('report') || has('cash');
  const managed = property.kind === 'managed';
  const mine = (row: { property_id: string | null }) => row.property_id === property.id;
  const expenses = data.expenses.filter((x) => mine(x) && x.scope !== 'private');
  const visible = new Set(expenses.map((x) => x.id));
  return {
    profile: { ...data.profile, name: '' },
    properties: [{ ...property, notes: '', deposit: 0, archived: false }],
    // The owner's own party appears under the owner's name. It keeps is_me so
    // the figures add up; screens label it by name when a member looks.
    parties: data.parties.filter(mine).map((p) => ({ ...p, name: p.is_me && ownerName ? ownerName : p.name })),
    rules: figures ? data.rules.filter(mine).map((r) => ({ ...r, commission_rate: managed ? 0 : r.commission_rate })) : [],
    bookings: has('income') || figures ? data.bookings.filter(mine).map((b) => ({ ...b, commission_rate: managed ? null : b.commission_rate })) : [],
    expenses: has('expenses') || figures ? expenses : [],
    recurring: [],
    transfers: has('cash') ? data.transfers.filter(mine) : [],
    docs: has('invoices') ? data.docs.filter((d) => mine(d) && (!d.expense_id || visible.has(d.expense_id))) : [],
    shares: [],
    members: [],
  };
}
