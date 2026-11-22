/**
 * Supabase implementation of the backend.
 *
 * Only the publishable key ships in the app. It grants nothing by itself:
 * every table is protected by row-level security (see supabase/migrations).
 */
import 'expo-sqlite/localStorage/install';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { type Data, type Profile, emptyData } from '@/core/types';

import { AiUnavailable, type Backend, type Session, type Table } from './backend';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** False when the app was built without cloud settings: only the demo works. */
export const cloudConfigured = Boolean(url && key);

const BUCKET = 'documents';
const PAGE = 1000;

/** Postgres returns `numeric` columns as strings when large; keep numbers as numbers. */
const NUMERIC = ['amount', 'fx_rate', 'commission_rate', 'deposit', 'size'] as const;
function numbers<T extends Record<string, unknown>>(row: T): T {
  for (const k of NUMERIC) if (typeof row[k] === 'string') (row as Record<string, unknown>)[k] = Number(row[k]);
  return row;
}

export function createSupabaseBackend(): Backend {
  const db: SupabaseClient = createClient(url, key, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      // On the web, sign-in and password-reset links land with the session in the URL.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') db.auth.startAutoRefresh();
      else db.auth.stopAutoRefresh();
    });
  }

  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? '' } : null;

  /** Unwraps a Supabase response, turning its error into an exception. */
  function check<R extends { data: unknown; error: unknown }>(res: R): R['data'] {
    if (res.error) throw new Error((res.error as { message?: string }).message ?? 'Erreur inconnue');
    return res.data;
  }

  /** Reads a whole table, page by page (the API returns 1000 rows at most). */
  async function all<T>(table: string): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = check(
        await db.from(table).select('*').order('created_at').order('id').range(from, from + PAGE - 1),
      ) as T[];
      rows.push(...page.map((r) => numbers(r as Record<string, unknown>) as T));
      if (page.length < PAGE) return rows;
    }
  }

  async function userId(): Promise<string> {
    const { data } = await db.auth.getSession();
    if (!data.session) throw new Error('signed_out');
    return data.session.user.id;
  }

  async function callAi<T>(body: object): Promise<T> {
    const { data, error } = await db.functions.invoke('ai', { body });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 503) throw new AiUnavailable('not_configured');
      if (status === 429) throw new AiUnavailable('quota');
      throw new Error(error.message);
    }
    return data as T;
  }

  return {
    demo: false,

    async getSession() {
      return toSession((await db.auth.getSession()).data.session);
    },
    onAuthChange(listener) {
      const { data } = db.auth.onAuthStateChange((_event, s) => listener(toSession(s)));
      return () => data.subscription.unsubscribe();
    },
    async sendSignInLink(email) {
      const site = process.env.EXPO_PUBLIC_WEB_URL;
      check(await db.auth.signInWithOtp({ email, options: site ? { emailRedirectTo: site } : undefined }));
    },
    async verifySignInCode(email, code) {
      check(await db.auth.verifyOtp({ email, token: code, type: 'email' }));
    },
    async signIn(email, password) {
      check(await db.auth.signInWithPassword({ email, password }));
    },
    async signUp(email, password) {
      const data = check(await db.auth.signUp({ email, password }));
      return !data.session;
    },
    async sendPasswordReset(email) {
      const site = process.env.EXPO_PUBLIC_WEB_URL;
      check(await db.auth.resetPasswordForEmail(email, site ? { redirectTo: `${site}/reset` } : undefined));
    },
    async updatePassword(password) {
      check(await db.auth.updateUser({ password }));
    },
    async signOut() {
      await db.auth.signOut();
    },
    async deleteAccount() {
      // The edge function removes the stored files, then the user; the
      // database cascade removes every row they own.
      const { error } = await db.functions.invoke('delete-account', { body: {} });
      if (error) throw new Error(error.message);
      await db.auth.signOut();
    },

    async load() {
      const id = await userId();
      const data: Data = emptyData();
      const [profile, properties, parties, rules, bookings, expenses, recurring, transfers, docs, shares] =
        await Promise.all([
          db.from('profiles').select('*').eq('id', id).maybeSingle(),
          all('properties'),
          all('parties'),
          all('rules'),
          all('bookings'),
          all('expenses'),
          all('recurring'),
          all('transfers'),
          all('docs'),
          db.from('shares').select('id,property_id,party_id,title,token,revoked,created_at').order('created_at'),
        ]);
      const p = check(profile) as (Profile & { id: string }) | null;
      if (p) data.profile = { name: p.name, currency: p.currency, fx: p.fx, locale: p.locale };
      else check(await db.from('profiles').insert({ id, ...data.profile }));
      Object.assign(data, { properties, parties, rules, bookings, expenses, recurring, transfers, docs });
      data.shares = check(shares) as Data['shares'];
      return data;
    },
    async saveProfile(profile) {
      check(await db.from('profiles').upsert({ id: await userId(), ...profile }));
    },
    async upsert(table: Table, rows) {
      if (rows.length) check(await db.from(table).upsert(rows));
    },
    async remove(table: Table, ids) {
      if (ids.length) check(await db.from(table).delete().in('id', ids));
    },

    async uploadFile(path, bytes, mime) {
      // `path` is relative to the user's own folder; storage policies enforce it.
      check(
        await db.storage
          .from(BUCKET)
          .upload(`${await userId()}/${path}`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { contentType: mime, upsert: true }),
      );
    },
    async fileUrl(path) {
      const data = check(await db.storage.from(BUCKET).createSignedUrl(`${await userId()}/${path}`, 600));
      return data!.signedUrl;
    },
    async removeFiles(paths) {
      const id = await userId();
      if (paths.length) check(await db.storage.from(BUCKET).remove(paths.map((p) => `${id}/${p}`)));
    },

    async publishShare(share, payload) {
      const row = check(
        await db
          .from('shares')
          .insert({ ...share, payload })
          .select('id,property_id,party_id,title,token,revoked,created_at')
          .single(),
      );
      return row as Data['shares'][number];
    },
    async revokeShares(ids) {
      if (ids.length) check(await db.from('shares').update({ revoked: true }).in('id', ids));
    },
    async fetchShared(token) {
      return check(await db.rpc('get_shared_statement', { p_token: token }));
    },

    readReceipt: (image, mime) => callAi({ action: 'receipt', image, mime }),
    async ask(question, context) {
      return (await callAi<{ answer: string }>({ action: 'ask', question, context })).answer;
    },
  };
}
