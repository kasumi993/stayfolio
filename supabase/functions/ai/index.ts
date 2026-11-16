/**
 * The only place where AI is called. Runs on Supabase Edge Functions, so the
 * Anthropic API key never reaches the phone.
 *
 * Two actions:
 *   - "receipt": reads a photographed receipt and returns the fields of an expense;
 *   - "ask": answers a question from monthly totals sent by the app.
 *
 * Cost control: the cheapest current model, short answers, and a daily cap of
 * calls per user. Without an ANTHROPIC_API_KEY secret the function answers
 * 503 and the app simply hides its AI features.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-haiku-5-5';
const DAILY_LIMIT = 60;
const MAX_IMAGE_BASE64 = 5_500_000; // about 4 MB of image
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CATEGORIES = ['rent', 'cleaning', 'electricity', 'water', 'internet', 'supplies', 'equipment', 'maintenance', 'transport', 'taxes', 'other'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RECEIPT_PROMPT = `You read receipts and invoices for a short-term rental host in Senegal.
Return ONLY a JSON object, no other text, with these keys (omit a key when unsure):
- "vendor": the shop or supplier name
- "date": the purchase date as YYYY-MM-DD
- "amount": the total paid, as a number without thousands separators
- "currency": "XOF" (CFA francs, also written F, FCFA, CFA), "EUR" or "USD"
- "category": one of ${CATEGORIES.join(', ')}
- "description": what was bought, in French, at most 8 words
Never invent a value that is not legible on the document.`;

const ASK_PROMPT = `You help a short-term rental host understand their own books.
You receive monthly totals as JSON and one question. Answer in the language given in "language" (fr or en),
in at most 5 short sentences, in plain text without lists or markdown. Use only the figures provided:
quote amounts with their currency, and say so when the data does not answer the question.
Never give tax, legal or investment advice.`;

async function callClaude(key: string, system: string, content: unknown, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  if (!response.ok) throw new Error(`anthropic ${response.status}`);
  const data = await response.json();
  return (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
}

/** Keeps only the expected keys, with the expected types. */
function cleanReceipt(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return {};
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return {};
  }
  const out: Record<string, unknown> = {};
  if (typeof raw.vendor === 'string') out.vendor = raw.vendor.slice(0, 80);
  if (typeof raw.description === 'string') out.description = raw.description.slice(0, 120);
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) out.date = raw.date;
  if (typeof raw.amount === 'number' && Number.isFinite(raw.amount) && raw.amount > 0) out.amount = raw.amount;
  if (typeof raw.currency === 'string' && ['XOF', 'EUR', 'USD'].includes(raw.currency)) out.currency = raw.currency;
  if (typeof raw.category === 'string' && CATEGORIES.includes(raw.category)) out.category = raw.category;
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'ai_not_configured' }, 503);

  // Act as the calling user: the counter below is theirs, protected by RLS.
  const authorization = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: calls, error } = await supabase.rpc('bump_ai_usage');
  if (error) return json({ error: 'unauthorized' }, 401);
  if ((calls as number) > DAILY_LIMIT) return json({ error: 'quota' }, 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    if (body.action === 'receipt') {
      const image = body.image;
      const mime = body.mime;
      if (typeof image !== 'string' || typeof mime !== 'string' || !IMAGE_TYPES.includes(mime) || image.length > MAX_IMAGE_BASE64)
        return json({ error: 'bad_request' }, 400);
      const text = await callClaude(
        key,
        RECEIPT_PROMPT,
        [
          { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
          { type: 'text', text: 'Read this document.' },
        ],
        1200,
      );
      return json(cleanReceipt(text));
    }

    if (body.action === 'ask') {
      const question = typeof body.question === 'string' ? body.question.slice(0, 500) : '';
      const context = JSON.stringify(body.context ?? {});
      if (!question || context.length > 80_000) return json({ error: 'bad_request' }, 400);
      const answer = await callClaude(key, ASK_PROMPT, `Figures:\n${context}\n\nQuestion: ${question}`, 1500);
      return json({ answer: answer.trim() });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'ai_failed' }, 502);
  }
});
