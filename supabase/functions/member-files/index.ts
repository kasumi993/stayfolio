/**
 * Invoices for people who open a property through a member link (no account).
 * The database functions handle every other read and write; files need this
 * function because stored files are private and only the server can hand out
 * a temporary link or store a new one.
 *
 * POST { token, action: 'url', doc_id }                         → { url }
 * POST { token, action: 'upload', file: base64, mime, name,
 *        title?, date?, amount?, expense_id? }                   → { doc }
 *
 * Checks, for both: the token names a member; the member may see invoices
 * ('invoices' page); the invoice or expense belongs to the member's property
 * and is never tied to a private expense. Upload also needs `can_edit`.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'documents';
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const refuse = () => json({ error: 'not allowed' }, 403);

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const token = typeof body.token === 'string' ? body.token : '';
  if (token.length < 40) return refuse();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: member } = await admin.from('members').select('id, owner_id, property_id, can_edit, pages').eq('token', token).maybeSingle();
  if (!member || !(member.pages as string[]).includes('invoices')) return refuse();

  // An expense the member may attach to: same owner and property, not private.
  const expenseOk = async (id: unknown) => {
    if (id === null || id === undefined || id === '') return true;
    const { data } = await admin.from('expenses').select('id').eq('id', String(id)).eq('owner_id', member.owner_id).eq('property_id', member.property_id).neq('scope', 'private').maybeSingle();
    return !!data;
  };

  if (body.action === 'url') {
    const { data: doc } = await admin.from('docs').select('path, expense_id').eq('id', String(body.doc_id ?? '')).eq('owner_id', member.owner_id).eq('property_id', member.property_id).maybeSingle();
    if (!doc || !(await expenseOk(doc.expense_id))) return refuse();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(`${member.owner_id}/${doc.path}`, 600);
    if (error || !data) return json({ error: 'storage' }, 500);
    return json({ url: data.signedUrl });
  }

  if (body.action === 'upload') {
    if (!member.can_edit) return refuse();
    const mime = String(body.mime ?? '');
    const ext = TYPES[mime];
    if (!ext || typeof body.file !== 'string') return json({ error: 'bad file' }, 400);
    const bytes = fromBase64(body.file);
    if (!bytes.length || bytes.length > MAX_BYTES) return json({ error: 'bad file' }, 400);
    if (!(await expenseOk(body.expense_id))) return refuse();
    const month = new Date().toISOString().slice(0, 7);
    const path = `${month}/${crypto.randomUUID()}.${ext}`;
    const stored = await admin.storage.from(BUCKET).upload(`${member.owner_id}/${path}`, bytes, { contentType: mime });
    if (stored.error) return json({ error: 'storage' }, 500);
    const amount = Number(body.amount);
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
    const { data: doc, error } = await admin
      .from('docs')
      .insert({
        id: typeof body.id === 'string' && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : crypto.randomUUID(),
        owner_id: member.owner_id,
        property_id: member.property_id,
        expense_id: body.expense_id ? String(body.expense_id) : null,
        path,
        name: String(body.name ?? '').slice(0, 200),
        mime,
        size: bytes.length,
        title: String(body.title ?? '').slice(0, 200),
        date,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      })
      .select('id, property_id, expense_id, booking_id, name, mime, size, title, date, amount, created_at')
      .single();
    if (error) {
      await admin.storage.from(BUCKET).remove([`${member.owner_id}/${path}`]);
      return json({ error: 'database' }, 500);
    }
    return json({ doc: { ...doc, path: '' } });
  }

  return json({ error: 'bad request' }, 400);
});
