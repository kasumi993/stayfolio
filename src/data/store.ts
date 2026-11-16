/**
 * The app's single store: who is signed in, their data, what is selected.
 *
 * Everything the user owns is loaded once and kept in memory (a host's books
 * are a few thousand rows at most), so screens compute their figures
 * instantly with the pure functions of `src/core`. Writes are optimistic:
 * the screen updates at once, and rolls back if the server refuses.
 */
import { create } from 'zustand';

import { currentMonth } from '@/core/dates';
import type { ImportPlan } from '@/core/importWorkbook';
import { newId, now } from '@/core/id';
import { dueOccurrences } from '@/core/recurring';
import type { SharedStatement } from '@/core/sharing';
import { type Data, type Doc, type ID, type Month, type Profile, type ShareLink, emptyData } from '@/core/types';

import type { Backend, Session, Table } from './backend';
import { createDemoBackend } from './demo';
import { cloudConfigured, createSupabaseBackend } from './supabase';

type Status = 'starting' | 'signedOut' | 'loading' | 'ready';
type Row = { id: ID };

interface Store {
  status: Status;
  backend: Backend;
  session: Session | null;
  data: Data;
  /** Property filter shared by the tabs. null = all properties. */
  propertyId: ID | null;
  month: Month;
  /** Last failure, shown as a banner until dismissed. */
  error: string | null;

  start(): Promise<void>;
  enterDemo(): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
  /** Generates the recurring expenses that are due and not yet in the ledger. */
  syncRecurring(): Promise<void>;
  setProperty(id: ID | null): void;
  setMonth(month: Month): void;
  clearError(): void;

  save<T extends Row>(table: Table, rows: T | T[]): Promise<void>;
  remove(table: Table, ids: ID | ID[]): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
  addDoc(file: { bytes: Uint8Array; mime: string; name: string }, link: Partial<Pick<Doc, 'property_id' | 'expense_id' | 'booking_id'>>): Promise<Doc>;
  removeDoc(doc: Doc): Promise<void>;
  applyImport(plan: ImportPlan): Promise<void>;
  publish(share: Pick<ShareLink, 'property_id' | 'party_id' | 'title'>, payload: SharedStatement): Promise<ShareLink>;
  /** Withdraws published links: their statements can no longer be read. */
  revokeShares(ids: ID[]): Promise<void>;
}

const cloud = cloudConfigured ? createSupabaseBackend() : null;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useStore = create<Store>((set, get) => {
  /** Applies a change locally, then remotely; undoes it if the server fails. */
  async function mutate(apply: (d: Data) => Data, remote: () => Promise<unknown>) {
    const before = get().data;
    set({ data: apply(before) });
    try {
      await remote();
    } catch (e) {
      set({ data: before, error: message(e) });
      throw e;
    }
  }

  async function load() {
    // A refresh while the app is in use happens quietly, without a loading screen.
    if (get().status !== 'ready') set({ status: 'loading' });
    try {
      const data = await get().backend.load();
      const keep = data.properties.some((p) => p.id === get().propertyId);
      set({ data, status: 'ready', propertyId: keep ? get().propertyId : null });
      await get().syncRecurring();
    } catch (e) {
      set({ status: 'ready', error: message(e) });
    }
  }

  return {
    status: 'starting',
    backend: cloud ?? createDemoBackend(),
    session: null,
    data: emptyData(),
    propertyId: null,
    month: currentMonth(),
    error: null,

    async start() {
      if (!cloud) return set({ status: 'signedOut' });
      // Loads the data once per signed-in user, whichever notices them first:
      // the initial check below or the auth listener.
      let loadedFor: string | null = null;
      const onSession = (session: Session | null) => {
        if (get().backend.demo) return;
        set({ session });
        if (!session) {
          loadedFor = null;
          set({ status: 'signedOut', data: emptyData() });
        } else if (session.userId !== loadedFor) {
          loadedFor = session.userId;
          // Deferred: Supabase must not be called from inside its own auth callback.
          setTimeout(() => void load(), 0);
        }
      };
      cloud.onAuthChange(onSession);
      onSession(await cloud.getSession().catch(() => null));
    },

    async enterDemo() {
      const backend = createDemoBackend();
      set({ backend, session: await backend.getSession(), propertyId: null, month: currentMonth() });
      await load();
    },

    async signOut() {
      const { backend } = get();
      await backend.signOut();
      set({ backend: cloud ?? createDemoBackend(), session: null, data: emptyData(), status: 'signedOut', propertyId: null });
    },

    reload: load,

    async syncRecurring() {
      const due = dueOccurrences(get().data, currentMonth());
      if (due.length) await get().save('expenses', due).catch(() => {});
    },

    setProperty: (propertyId) => set({ propertyId }),
    setMonth: (month) => set({ month }),
    clearError: () => set({ error: null }),

    async save(table, rows) {
      const list: Row[] = Array.isArray(rows) ? rows : [rows];
      if (!list.length) return;
      await mutate(
        (d) => {
          const next = [...(d[table] as Row[])];
          for (const row of list) {
            const i = next.findIndex((r) => r.id === row.id);
            if (i >= 0) next[i] = row;
            else next.push(row);
          }
          return { ...d, [table]: next };
        },
        () => get().backend.upsert(table, list),
      );
    },

    async remove(table, ids) {
      const list = Array.isArray(ids) ? ids : [ids];
      await mutate(
        (d) => ({ ...d, [table]: (d[table] as Row[]).filter((r) => !list.includes(r.id)) }),
        () => get().backend.remove(table, list),
      );
      // Rows that depended on what was removed are gone server-side too.
      if (table === 'properties' || table === 'parties' || table === 'recurring') await get().reload();
    },

    async saveProfile(profile) {
      await mutate((d) => ({ ...d, profile }), () => get().backend.saveProfile(profile));
    },

    async addDoc(file, link) {
      const ext = file.mime === 'application/pdf' ? 'pdf' : file.mime === 'image/png' ? 'png' : 'jpg';
      const doc: Doc = {
        id: newId(),
        property_id: link.property_id ?? null,
        expense_id: link.expense_id ?? null,
        booking_id: link.booking_id ?? null,
        path: `${now().slice(0, 7)}/${newId()}.${ext}`,
        name: file.name,
        mime: file.mime,
        size: file.bytes.length,
        created_at: now(),
      };
      try {
        await get().backend.uploadFile(doc.path, file.bytes, file.mime);
      } catch (e) {
        set({ error: message(e) });
        throw e;
      }
      await get().save('docs', doc);
      return doc;
    },

    async removeDoc(doc) {
      await get().remove('docs', doc.id);
      await get().backend.removeFiles([doc.path]).catch(() => {});
    },

    async applyImport(plan) {
      const { backend } = get();
      try {
        // Order matters: parents before the rows that reference them.
        await backend.upsert('properties', [plan.property]);
        await backend.upsert('parties', plan.parties);
        await backend.upsert('rules', [plan.rule]);
        await backend.upsert('bookings', plan.bookings);
        await backend.upsert('recurring', plan.recurring);
        await backend.upsert('expenses', plan.expenses);
        await backend.upsert('transfers', plan.transfers);
        const { profile } = get().data;
        await backend.saveProfile({ ...profile, fx: { ...plan.fx, ...profile.fx } });
      } catch (e) {
        // Leave nothing half-imported behind.
        await backend.remove('properties', [plan.property.id]).catch(() => {});
        set({ error: message(e) });
        throw e;
      }
      await load();
      set({ propertyId: plan.property.id });
    },

    async publish(share, payload) {
      const link = await get().backend.publishShare({ id: newId(), ...share }, payload);
      set({ data: { ...get().data, shares: [...get().data.shares, link] } });
      return link;
    },

    async revokeShares(ids) {
      await mutate(
        (d) => ({ ...d, shares: d.shares.map((s) => (ids.includes(s.id) ? { ...s, revoked: true } : s)) }),
        () => get().backend.revokeShares(ids),
      );
    },
  };
});

/** Convenience selector for the loaded data. */
export const useData = () => useStore((s) => s.data);
