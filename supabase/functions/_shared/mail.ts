/**
 * Sending through Brevo's transactional API. The API key is a function secret
 * (BREVO_API_KEY) that the owner enters in the Supabase dashboard; it never
 * reaches the app. Templates live in Brevo; this only sends their id and the
 * values to fill in.
 *
 * Source of truth: supabase/functions/_shared/mail.ts, copied into each
 * function by scripts/bundle-functions.mjs (a deployed function cannot reach
 * a sibling folder).
 */
export const APP_URL = Deno.env.get('APP_URL') ?? 'https://stayfolio-gamma.vercel.app';
export const SENDER = { name: 'Stayfolio', email: Deno.env.get('MAIL_FROM') ?? 'hello@miracute.com' };
/** Brevo template ids (Stayfolio · Invitation, Stayfolio · Rapport mensuel). */
export const TEMPLATES = {
  invite: Number(Deno.env.get('BREVO_TEMPLATE_INVITE') ?? '9'),
  report: Number(Deno.env.get('BREVO_TEMPLATE_REPORT') ?? '10'),
};

export class MailError extends Error {}

export async function sendTemplate(
  templateId: number,
  to: { email: string; name?: string },
  params: Record<string, unknown>,
  replyTo?: { email: string; name?: string },
): Promise<string> {
  const key = Deno.env.get('BREVO_API_KEY');
  if (!key) throw new MailError('not_configured');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ templateId, sender: SENDER, to: [to], params, ...(replyTo?.email ? { replyTo } : {}) }),
  });
  if (!res.ok) throw new MailError(`send_failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = (await res.json().catch(() => ({}))) as { messageId?: string };
  return out.messageId ?? '';
}

/** "541 010 F", "1 250 €": the way the app writes amounts. */
export function money(value: number, currency: string, sign = false): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(Math.abs(value))).replace(/\s/g, ' ');
  const symbol = currency === 'XOF' ? 'F' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  const s = value < -0.5 ? '−' : sign && value > 0.5 ? '+' : '';
  return `${s}${n} ${symbol}`;
}

export const PAGE_LABELS: Record<string, string> = {
  income: 'revenus',
  expenses: 'dépenses',
  invoices: 'factures',
  report: 'résultat et bilan',
  cash: 'caisse et apports',
};
