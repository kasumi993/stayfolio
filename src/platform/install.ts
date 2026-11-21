/**
 * Installing the web version on a phone or a computer (as a PWA).
 *
 * Chromium browsers (Android, Windows, macOS) fire `beforeinstallprompt`,
 * which lets us show our own "Install" button. Safari on iPhone and iPad has
 * no such event: the person adds the app from the Share menu, so we explain
 * how. In the native app, and once installed, there is nothing to offer.
 */
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

import { getPref, setPref } from './prefs';

interface PromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallWay =
  /** The browser can install it with one tap. */
  | 'prompt'
  /** iPhone or iPad: Share → Add to Home Screen. */
  | 'ios'
  /** Already installed, native app, or a browser that cannot install. */
  | 'none';

const web = Platform.OS === 'web' && typeof window !== 'undefined';
let deferred: PromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function standalone(): boolean {
  if (!web) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function apple(): boolean {
  if (!web) return false;
  const ua = navigator.userAgent;
  // iPadOS presents itself as a Mac; touch gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

if (web) {
  // The event can fire before any screen mounts, so it is caught here, on import.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

function way(): InstallWay {
  if (!web || installed || standalone()) return 'none';
  if (deferred) return 'prompt';
  return apple() ? 'ios' : 'none';
}

/** How this device can install the app, kept up to date. */
export function useInstallWay(): InstallWay {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    way,
    () => 'none' as InstallWay,
  );
}

/** Opens the browser's own install dialog. Resolves true if the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}

const DISMISS_KEY = 'install.dismissedAt';
/** After "Not now", the banner stays away this long. Settings still offer it. */
const QUIET_DAYS = 30;

export function bannerDismissed(): boolean {
  const at = Number(getPref(DISMISS_KEY) ?? 0);
  return at > 0 && Date.now() - at < QUIET_DAYS * 86_400_000;
}

export function dismissBanner(): void {
  setPref(DISMISS_KEY, String(Date.now()));
}
