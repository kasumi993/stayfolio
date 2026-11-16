/**
 * Small preferences kept on the device (not in the account): they apply
 * before sign-in and may differ from one device to another.
 */
import 'expo-sqlite/localStorage/install';

export function getPref(key: string): string | null {
  try {
    return localStorage.getItem(`stayfolio.${key}`);
  } catch {
    return null;
  }
}

export function setPref(key: string, value: string): void {
  try {
    localStorage.setItem(`stayfolio.${key}`, value);
  } catch {
    // Storage can be unavailable (private browsing): the preference lasts for the session only.
  }
}
