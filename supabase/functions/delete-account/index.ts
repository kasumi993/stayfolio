/**
 * Deletes the signed-in user's account: their stored files first, then the
 * user. The database cascade removes every row they own (App Store rule:
 * an account created in the app can be deleted in the app).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'documents';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // Files live under <user id>/<yyyy-mm>/<file>.
  const { data: folders } = await admin.storage.from(BUCKET).list(user.id, { limit: 1000 });
  for (const folder of folders ?? []) {
    const prefix = `${user.id}/${folder.name}`;
    const { data: files } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${prefix}/${f.name}`);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'delete failed' }, 500);
  return json({ ok: true });
});
