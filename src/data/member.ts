/**
 * Backends for the member view: someone who opens a property through the
 * owner's personal link, without an account.
 *
 * - createMemberBackend: talks to the database functions member_load,
 *   member_save and member_delete, and to the member-files edge function,
 *   with the publishable key only. The link token is the whole credential;
 *   every check happens server-side (supabase/migrations/*_members.sql).
 * - createPreviewBackend: what the owner sees when she opens "Voir comme"
 *   on her own member. Same filtering, computed on the device, read-only.
 */
import { memberView } from '@/core/member';
import { type Data, type Doc, type Member, MEMBER_PAGES, type MemberPage, emptyData } from '@/core/types';

import { AiUnavailable, type Backend, type MemberAccess, type Table } from './backend';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Raised when a link is unknown, was renewed or was cut. */
export class LinkRevoked extends Error {
  constructor() {
    super('link_revoked');
  }
}

const notAllowed = () => Promise.reject(new Error('not allowed'));
const NUMERIC = ['amount', 'fx_rate', 'commission_rate', 'size'] as const;
function numbers<T>(row: T): T {
  const r = row as Record<string, unknown>;
  for (const k of NUMERIC) if (typeof r[k] === 'string') r[k] = Number(r[k]);
  return row;
}

/** Everything a member backend refuses: account and owner-only actions. */
const ownerOnly = {
  getSession: async () => null,
  onAuthChange: () => () => {},
  sendSignInLink: notAllowed,
  verifySignInCode: notAllowed,
  signIn: notAllowed,
  signUp: notAllowed,
  sendPasswordReset: notAllowed,
  updatePassword: notAllowed,
  signOut: async () => {},
  deleteAccount: notAllowed,
  saveProfile: notAllowed,
  removeFiles: async () => {},
  saveMember: notAllowed,
  rotateMemberToken: notAllowed,
  publishShare: notAllowed,
  revokeShares: notAllowed,
  fetchShared: async () => null,
  readReceipt: () => Promise.reject(new AiUnavailable('not_configured')),
  ask: () => Promise.reject(new AiUnavailable('not_configured')),
} satisfies Partial<Backend>;

interface Loaded {
  member: { id: string; name: string; can_edit: boolean; pages: MemberPage[] };
  owner_name: string;
  currency: string;
  fx: Record<string, number>;
  property: Data['properties'][number];
  parties: Data['parties'];
  rules: Data['rules'];
  bookings: Data['bookings'];
  expenses: Data['expenses'];
  transfers: Data['transfers'];
  docs: Omit<Doc, 'path'>[];
}

/** Invoices reach a member without their storage path: this stands in for it. */
const docPath = (id: string) => `doc:${id}`;

export function createMemberBackend(token: string): Backend {
  const access: MemberAccess = { token, name: '', ownerName: '', canEdit: false, pages: [], preview: false };
  /** Files picked by the member, held until the invoice row is saved with them. */
  const pending = new Map<string, { bytes: Uint8Array; mime: string }>();
  /** Invoice id behind a path the app generated for a new upload. */
  const uploaded = new Map<string, string>();

  async function rpc<T>(fn: string, args: object): Promise<T> {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
      throw msg.includes('not allowed') ? new Error('not allowed') : new Error(msg);
    }
    return body as T;
  }

  async function files<T>(body: object): Promise<T> {
    const res = await fetch(`${url}/functions/v1/member-files`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const out = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !out) throw new Error(out?.error ?? `HTTP ${res.status}`);
    return out;
  }

  const base64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return globalThis.btoa(binary);
  };

  return {
    demo: false,
    access,
    ...ownerOnly,

    async load() {
      const r = await rpc<Loaded | null>('member_load', { p_token: token });
      if (!r) throw new LinkRevoked();
      Object.assign(access, {
        name: r.member.name,
        ownerName: r.owner_name,
        canEdit: r.member.can_edit,
        pages: r.member.pages.filter((p) => MEMBER_PAGES.includes(p)),
      });
      const data = emptyData();
      data.profile = { ...data.profile, name: '', currency: r.currency, fx: r.fx ?? {} };
      data.properties = [r.property];
      data.parties = r.parties;
      data.rules = r.rules.map(numbers);
      data.bookings = r.bookings.map(numbers);
      data.expenses = r.expenses.map(numbers);
      data.transfers = r.transfers.map(numbers);
      data.docs = r.docs.map((d) => numbers({ ...d, path: docPath(d.id) }));
      return data;
    },

    async upsert(table: Table, rows: object[]) {
      for (const row of rows as { id: string; path?: string }[]) {
        if (table === 'docs' && row.path && pending.has(row.path)) {
          const file = pending.get(row.path)!;
          const d = row as unknown as Doc;
          await files({ action: 'upload', id: d.id, file: base64(file.bytes), mime: file.mime, name: d.name, title: d.title, date: d.date, amount: d.amount, expense_id: d.expense_id });
          pending.delete(row.path);
          uploaded.set(row.path, d.id);
        } else if (table === 'bookings' || table === 'expenses' || table === 'docs') {
          await rpc('member_save', { p_token: token, p_table: table, p_row: row });
        } else {
          throw new Error('not allowed');
        }
      }
    },
    async remove(table: Table, ids: string[]) {
      if (table !== 'bookings' && table !== 'expenses') throw new Error('not allowed');
      for (const id of ids) await rpc('member_delete', { p_token: token, p_table: table, p_id: id });
    },

    async uploadFile(path, bytes, mime) {
      if (!access.canEdit || !access.pages.includes('invoices')) throw new Error('not allowed');
      pending.set(path, { bytes, mime });
    },
    async fileUrl(path) {
      const id = path.startsWith('doc:') ? path.slice(4) : uploaded.get(path);
      if (!id) return '';
      return (await files<{ url: string }>({ action: 'url', doc_id: id })).url;
    },
  };
}

/** The owner's look at what one of her members sees. Read-only. */
export function createPreviewBackend(owner: Backend, data: Data, member: Member): Backend {
  const access: MemberAccess = {
    token: member.token,
    name: member.name,
    ownerName: data.profile.name,
    canEdit: false,
    pages: member.pages,
    preview: true,
  };
  return {
    demo: owner.demo,
    access,
    ...ownerOnly,
    load: async () => memberView(data, member, data.profile.name),
    upsert: notAllowed,
    remove: notAllowed,
    uploadFile: notAllowed,
    fileUrl: (path) => owner.fileUrl(path),
  };
}
