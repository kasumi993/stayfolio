/**
 * A photo or PDF picked from the "add" menu, waiting for the expense form to
 * open and take it. Kept out of the store because it is large and short-lived.
 */
import type { PickedFile } from '@/platform/pick';

let pending: PickedFile | null = null;

export const setPendingFile = (file: PickedFile | null) => {
  pending = file;
};

/** The waiting file, if any. Call `setPendingFile(null)` once it is taken. */
export const peekPendingFile = (): PickedFile | null => pending;
