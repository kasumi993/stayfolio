/**
 * The seam between the app and where data lives.
 *
 * Two implementations exist: `supabase.ts` (the real cloud backend) and
 * `demo.ts` (sample data kept in memory, used by "Explore the demo" and by
 * automated UI tests). The rest of the app only knows this interface.
 */
import type { SharedStatement } from '@/core/sharing';
import type { Data, ID, Profile, ShareLink } from '@/core/types';

export type Table =
  | 'properties'
  | 'parties'
  | 'rules'
  | 'bookings'
  | 'expenses'
  | 'recurring'
  | 'transfers'
  | 'docs'
  | 'shares';

export interface Session {
  userId: string;
  email: string;
}

export interface PublishedStatement {
  title: string;
  created_at: string;
  statement: SharedStatement;
}

/** What the AI read on a receipt. Every field may be missing. */
export interface ReceiptReading {
  vendor?: string;
  date?: string;
  amount?: number;
  currency?: string;
  category?: string;
  description?: string;
}

export interface Backend {
  readonly demo: boolean;

  getSession(): Promise<Session | null>;
  onAuthChange(listener: (session: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** Resolves to true when the user must confirm their email before signing in. */
  signUp(email: string, password: string): Promise<boolean>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;

  load(): Promise<Data>;
  saveProfile(profile: Profile): Promise<void>;
  upsert(table: Table, rows: object[]): Promise<void>;
  remove(table: Table, ids: ID[]): Promise<void>;

  uploadFile(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  /** A temporary link to view a stored file. */
  fileUrl(path: string): Promise<string>;
  removeFiles(paths: string[]): Promise<void>;

  publishShare(share: Omit<ShareLink, 'token' | 'created_at' | 'revoked'>, payload: SharedStatement): Promise<ShareLink>;
  /** Makes published links unreadable. The snapshots are kept, flagged revoked. */
  revokeShares(ids: ID[]): Promise<void>;
  fetchShared(token: string): Promise<PublishedStatement | null>;

  readReceipt(imageBase64: string, mime: string): Promise<ReceiptReading>;
  ask(question: string, context: unknown): Promise<string>;
}

/** Raised by AI calls when no API key has been configured on the server. */
export class AiUnavailable extends Error {
  constructor(public reason: 'not_configured' | 'quota' | 'demo') {
    super(reason);
  }
}
