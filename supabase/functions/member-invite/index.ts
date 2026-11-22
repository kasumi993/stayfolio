/**
 * Emails a member their personal link, from the member form ("Envoyer par
 * e-mail"). Signed-in owner only: the member is read through row-level
 * security, so an owner can only send links of her own members. Replies go
 * to the owner's own address.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { APP_URL, MailError, PAGE_LABELS, TEMPLATES, sendTemplate } from './mail.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  const body = await req.json().catch(() => ({}));
  const id = typeof body.member_id === 'string' ? body.member_id : '';
  const { data: m } = await db.from('members').select('id, property_id, name, email, token, can_edit, pages').eq('id', id).maybeSingle();
  if (!m) return json({ error: 'not found' }, 404);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email ?? '')) return json({ error: 'no_email' }, 400);
  const { data: property } = await db.from('properties').select('name').eq('id', m.property_id).maybeSingle();
  const { data: profile } = await db.from('profiles').select('name').eq('id', user.id).maybeSingle();
  const owner = profile?.name?.trim() || 'La propriétaire';
  const pages = (m.pages as string[]).map((p) => PAGE_LABELS[p] ?? p);

  try {
    await sendTemplate(
      TEMPLATES.invite,
      { email: m.email, name: m.name },
      {
        name: m.name,
        owner,
        property: property?.name ?? 'ce logement',
        access: m.can_edit ? 'Consulter et modifier' : 'Consulter',
        pages: pages.length ? pages.join(', ').replace(/^./, (c) => c.toUpperCase()) : '',
        link: `${APP_URL}/m/${m.token}`,
      },
      user.email ? { email: user.email, name: owner } : undefined,
    );
  } catch (e) {
    const code = e instanceof MailError && e.message === 'not_configured' ? 'mail_not_configured' : 'send_failed';
    console.error(String(e));
    return json({ error: code }, code === 'mail_not_configured' ? 503 : 502);
  }
  return json({ ok: true });
});
