/**
 * The monthly recap: on the 1st of each month, every member who has "Rapport
 * mensuel" on (and an email address) receives the past month of their
 * property, limited to the pages their link allows, plus the running total
 * since the start. Sent through Brevo (template "Stayfolio · Rapport mensuel").
 *
 * Who may run it: the database schedule (pg_cron), which first writes a
 * one-time request row and passes its id. The row is consumed here; without a
 * fresh row the function refuses. No secret travels in the schedule.
 *   body: { request: uuid }   (row of public.report_requests)
 * A request row can name one member (a sample sent from the member form) and
 * ask for a dry run, which returns the values without sending anything. Each
 * row works once (consumed_at).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { base, monthStatement, occupancy, payback } from './core/calc.ts';
import { addMonths, currentMonth } from './core/dates.ts';
import { memberView } from './core/member.ts';
import { dueOccurrences } from './core/recurring.ts';
import { type Data, type Member, emptyData } from './core/types.ts';
import { APP_URL, MailError, TEMPLATES, money, sendTemplate } from './mail.ts';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const CATEGORY: Record<string, string> = {
  rent: 'Loyer', cleaning: 'Ménage', electricity: 'Électricité', water: 'Eau', internet: 'Internet', supplies: 'Fournitures',
  equipment: 'Équipement', maintenance: 'Entretien', transport: 'Transport', taxes: 'Taxes et frais', other: 'Autre',
};
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} ${m.slice(0, 4)}`;
const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const day = (d: string) => `${Number(d.slice(8, 10))} ${SHORT[Number(d.slice(5, 7)) - 1]}`;
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const LIST = 8;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: string[]): T[] =>
  (rows ?? []).map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const k of keys) if (o[k] !== null && o[k] !== undefined) o[k] = Number(o[k]);
    delete o.owner_id;
    return o as T;
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: request } = await admin
    .from('report_requests')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', typeof body.request === 'string' ? body.request : '00000000-0000-0000-0000-000000000000')
    .is('consumed_at', null)
    .gte('created_at', since)
    .select('member_id, dry_run, month')
    .maybeSingle();
  if (!request) return json({ error: 'not allowed' }, 403);

  const month: string = request.month ?? addMonths(currentMonth(), -1);
  let query = admin.from('members').select('*').eq('monthly_report', true).neq('email', '');
  if (request.member_id) query = query.eq('id', request.member_id);
  const { data: members } = await query;

  const cache = new Map<string, { data: Data; ownerName: string; ownerEmail: string }>();
  const load = async (ownerId: string, propertyId: string) => {
    const key = `${ownerId}/${propertyId}`;
    if (cache.has(key)) return cache.get(key)!;
    const own = <T>(table: string) => admin.from(table).select('*').eq('owner_id', ownerId).eq('property_id', propertyId) as unknown as Promise<{ data: T[] | null }>;
    const [profile, property, parties, rules, bookings, expenses, recurring, transfers, user] = await Promise.all([
      admin.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
      admin.from('properties').select('*').eq('id', propertyId).eq('owner_id', ownerId).maybeSingle(),
      own<Record<string, unknown>>('parties'),
      own<Record<string, unknown>>('rules'),
      own<Record<string, unknown>>('bookings'),
      own<Record<string, unknown>>('expenses'),
      own<Record<string, unknown>>('recurring'),
      own<Record<string, unknown>>('transfers'),
      admin.auth.admin.getUserById(ownerId),
    ]);
    const data = emptyData();
    if (profile.data) data.profile = { ...data.profile, ...profile.data, fx: profile.data.fx ?? {} };
    if (property.data) data.properties = num([property.data], ['deposit']) as unknown as Data['properties'];
    data.parties = num(parties.data, []) as unknown as Data['parties'];
    data.rules = num(rules.data, ['commission_rate']) as unknown as Data['rules'];
    data.bookings = num(bookings.data, ['amount', 'fx_rate', 'commission_rate']) as unknown as Data['bookings'];
    data.expenses = num(expenses.data, ['amount', 'fx_rate']) as unknown as Data['expenses'];
    data.recurring = num(recurring.data, ['amount', 'fx_rate']) as unknown as Data['recurring'];
    data.transfers = num(transfers.data, ['amount']) as unknown as Data['transfers'];
    // Monthly charges the app has not written yet (it writes them when opened).
    data.expenses = [...data.expenses, ...dueOccurrences(data, month)];
    const entry = { data, ownerName: profile.data?.name?.trim() ?? '', ownerEmail: user.data.user?.email ?? '' };
    cache.set(key, entry);
    return entry;
  };

  const results: { member: string; status: string; params?: Record<string, unknown> }[] = [];
  for (const m of (members ?? []) as (Member & { owner_id: string })[]) {
    try {
      const { data, ownerName, ownerEmail } = await load(m.owner_id, m.property_id);
      if (!data.properties.length) throw new Error('property gone');
      const view = memberView(data, m, ownerName);
      const pid = m.property_id;
      const cur = data.profile.currency;
      const sees = (p: string) => m.pages.includes(p as Member['pages'][number]);
      const figures = sees('report') || sees('cash');
      const s = monthStatement(view, pid, month);
      const occ = occupancy(view, pid, [month]);
      const pb = figures ? payback(view, pid, currentMonth()) : null;
      const incomes = sees('income') ? [...s.bookings].sort((a, b) => a.check_in.localeCompare(b.check_in)) : [];
      const costs = sees('expenses') ? s.expenseRows.filter((x) => x.scope !== 'private' && !x.excluded).sort((a, b) => a.date.localeCompare(b.date)) : [];
      const params = {
        name: m.name,
        owner: ownerName || 'La propriétaire',
        property: view.properties[0].name,
        month: monthLabel(month),
        link: `${APP_URL}/m/${m.token}`,
        result: figures ? money(s.net, cur, true) : '',
        result_note: figures ? (s.rentCovered === true ? 'Loyer couvert ce mois-ci' : s.rentCovered === false ? 'Le loyer n’est pas encore couvert' : '') : '',
        revenue: sees('income') || figures ? money(s.revenue, cur) : '',
        revenue_note: sees('income') || figures ? `${plural(s.bookings.length, 'versement', 'versements')}, ${plural(s.nights, 'nuit', 'nuits')}` : '',
        expenses: sees('expenses') || figures ? money(s.expenses, cur) : '',
        expenses_note: (sees('expenses') || figures) && s.rent ? `dont loyer ${money(s.rent, cur)}` : '',
        occupancy: sees('income') || figures ? `${Math.round(occ.rate * 100)} %` : '',
        occupancy_note: sees('income') || figures ? `${occ.booked} nuits réservées sur ${occ.available}` : '',
        cumulative: pb ? money(pb.cumulative, cur, true) : '',
        cumulative_note: pb ? (pb.cumulative < 0 ? 'encore à récupérer sur la mise de départ' : 'de bénéfice depuis le début') : '',
        income_list: incomes.slice(0, LIST).map((b) => ({ label: `${b.platform}${b.guest ? `, ${b.guest}` : ''}, ${day(b.check_in)}`, amount: money(base(b), cur) })),
        income_more: incomes.length > LIST ? `et ${incomes.length - LIST} autres` : '',
        expenses_list: costs.slice(0, LIST).map((x) => ({ label: `${x.description || x.vendor || CATEGORY[x.category] || 'Dépense'}, ${day(x.date)}`, amount: money(base(x), cur) })),
        expenses_more: costs.length > LIST ? `et ${costs.length - LIST} autres` : '',
      };
      if (request.dry_run) {
        results.push({ member: m.id, status: 'preview', params });
      } else {
        await sendTemplate(TEMPLATES.report, { email: m.email, name: m.name }, params, ownerEmail ? { email: ownerEmail, name: ownerName } : undefined);
        results.push({ member: m.id, status: 'sent' });
      }
    } catch (e) {
      console.error(m.id, String(e));
      results.push({ member: m.id, status: e instanceof MailError && e.message === 'not_configured' ? 'mail_not_configured' : 'failed' });
    }
  }
  return json({ month, results });
});
