/**
 * The seam between the app and where data lives.
 *
 * Two implementations exist: `supabase.ts` (the real cloud backend) and
 * `demo.ts` (sample data kept in memory, used by "Explore the demo" and by
 * automated UI tests). The rest of the app only knows this interface.
 */
import type { SharedStatement } from '@/core/sharing';
import type { Data, ID, Member, MemberPage, Profile, ShareLink } from '@/core/types';

export type Table =
  | 'properties'
  | 'parties'
  | 'rules'
  | 'bookings'
  | 'expenses'
  | 'recurring'
  | 'transfers'
  | 'docs'
  | 'shares'
  | 'members';

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

/** Who is looking, when the app is opened through a member link. */
export interface MemberAccess {
  token: string;
  name: string;
  ownerName: string;
  canEdit: boolean;
  pages: MemberPage[];
  /** The owner looking at their own member's view, from the property page. */
  preview: boolean;
}

export interface Backend {
  readonly demo: boolean;
  /** Set when the data comes through a member link. */
  readonly access?: MemberAccess;

  getSession(): Promise<Session | null>;
  onAuthChange(listener: (session: Session | null) => void): () => void;
  /** Emails a link that signs the person in when opened. Creates the account on first use. */
  sendSignInLink(email: string): Promise<void>;
  /**
   * Signs in with the code printed in the same email. Needed by the app
   * installed on an iPhone home screen: the link opens Safari, which does not
   * share its session with the installed app.
   */
  verifySignInCode(email: string, code: string): Promise<void>;
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

  /** Creates or updates a member; returns it with its link token. */
  saveMember(member: Omit<Member, 'token' | 'last_seen_at' | 'created_at'>): Promise<Member>;
  /** A new link for a member. The old one stops working at once. */
  rotateMemberToken(id: ID): Promise<string>;
  /** Emails a member their link (Brevo). Throws MailError when it cannot. */
  emailMemberLink(id: ID): Promise<void>;
  /** Sends a member last month's recap now, as on the 1st of the month. */
  sendMemberReport(id: ID): Promise<void>;

  publishShare(share: Omit<ShareLink, 'token' | 'created_at' | 'revoked'>, payload: SharedStatement): Promise<ShareLink>;
  /** Makes published links unreadable. The snapshots are kept, flagged revoked. */
  revokeShares(ids: ID[]): Promise<void>;
  fetchShared(token: string): Promise<PublishedStatement | null>;

  readReceipt(imageBase64: string, mime: string): Promise<ReceiptReading>;
  ask(question: string, context: unknown): Promise<string>;
}

/** Raised by AI calls when no API key has been configured on the server. */
/** Why an email could not go: no address, sending not set up, too soon, or another error. */
export class MailError extends Error {
  constructor(readonly reason: 'no_email' | 'not_configured' | 'too_soon' | 'failed') {
    super(reason);
  }
}

export class AiUnavailable extends Error {
  constructor(public reason: 'not_configured' | 'quota' | 'demo') {
    super(reason);
  }
}
