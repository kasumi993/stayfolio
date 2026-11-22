import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import '@/platform/install';
import { useT } from '@/i18n';
import { useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, isDark, maxWidth, radius, space } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const OWNER_ONLY = new Set(['welcome', 'recurring', 'transfer', 'rules', 'share', 'import', 'settings', 'property-form', 'properties', 'member']);

export default function RootLayout() {
  const [fontsReady] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });
  const starting = useStore((s) => s.status === 'starting');
  const theme = useStore((s) => s.theme);
  const ready = fontsReady && !starting;

  useEffect(() => {
    void useStore.getState().start();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  // Keyed by theme: changing theme re-creates every screen with the new colours.
  return <Screens key={theme} />;
}

function Screens() {
  const status = useStore((s) => s.status);
  const signedIn = status === 'ready' || status === 'loading';

  // Signed-out visitors only reach the welcome screen and the public pages
  // (a shared statement, the password reset, the privacy policy). The data
  // itself is protected server-side; this only decides which screen to show.
  const segments = useSegments();
  const area = segments[0] as string | undefined;
  const isPublic = area === 's' || area === 'reset' || area === 'privacy' || area === 'm';
  // Through a member link, the owner's own screens are out of reach (the
  // server refuses those actions anyway).
  const member = useStore((s) => !!s.backend.access);
  const ownerOnly = member && OWNER_ONLY.has(segments[segments.length - 1] as string);
  const misplaced = ownerOnly || (!isPublic && (signedIn ? area === 'welcome' : area !== 'welcome'));
  useEffect(() => {
    if (misplaced) router.replace(signedIn ? '/' : '/welcome');
  }, [misplaced, signedIn]);

  // Forms slide up full screen on a phone and open as a dialog over the page on a wide screen.
  const wide = useWide();
  const modal = wide
    ? ({ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } } as const)
    : ({ presentation: 'modal' } as const);
  return (
    <>
      <StatusBar style={isDark() ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'none' }} />
        <Stack.Screen name="entry" options={modal} />
        <Stack.Screen name="invoice" options={modal} />
        <Stack.Screen name="recurring" options={modal} />
        <Stack.Screen name="transfer" options={modal} />
        <Stack.Screen name="rules" options={modal} />
        <Stack.Screen name="share" options={modal} />
        <Stack.Screen name="import" options={modal} />
        <Stack.Screen name="settings" options={modal} />
        <Stack.Screen name="property-form" options={modal} />
        <Stack.Screen name="member" options={modal} />
        {/* Open to anyone holding the link or the reset email. */}
        <Stack.Screen name="s/[token]" />
        <Stack.Screen name="m/[token]" options={{ animation: 'none' }} />
        <Stack.Screen name="reset" />
        <Stack.Screen name="privacy" />
      </Stack>
      {misplaced || status === 'loading' ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' }}>
          {status === 'loading' ? <ActivityIndicator color={color.ink} /> : null}
        </View>
      ) : null}
      <ErrorBanner />
    </>
  );
}

/** Shows the last failed operation until the user dismisses it. */
function ErrorBanner() {
  const error = useStore((s) => s.error);
  const clear = useStore((s) => s.clearError);
  const insets = useSafeAreaInsets();
  const t = useT();
  if (!error) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + space.sm, alignItems: 'center', paddingHorizontal: space.lg }}>
      <Pressable onPress={clear} style={{ width: '100%', maxWidth: maxWidth - space.xl, backgroundColor: color.negative, borderRadius: radius.md, padding: space.md }}>
        <T variant="label" color={color.white}>
          {t('Cela n’a pas fonctionné. Vérifie ta connexion et réessaie.', 'That did not work. Check your connection and try again.')}
        </T>
        <T variant="small" color={color.white} numberOfLines={2} style={{ opacity: 0.85 }}>
          {error}
        </T>
      </Pressable>
    </View>
  );
}
