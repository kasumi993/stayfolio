import { Platform } from 'react-native';

/** Public address of the web app, where shared statements are read. */
export function webOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL;
  if (configured) return configured.replace(/\/$/, '');
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
}

export const shareUrl = (token: string): string => `${webOrigin()}/s/${token}`;
