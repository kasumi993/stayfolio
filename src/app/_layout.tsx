import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { useT } from '@/i18n';
import { T } from '@/ui/Text';
import { color, maxWidth, radius, space } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsReady] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });
  const status = useStore((s) => s.status);
  const signedIn = status === 'ready' || status === 'loading';
  const ready = fontsReady && status !== 'starting';

  useEffect(() => {
    void useStore.getState().start();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Signed-out visitors only reach the welcome screen and the two public
  // pages (a shared statement, the password reset). The data itself is
  // protected server-side; this only decides which screen to show.
  const segments = useSegments();
  const area = segments[0] as string | undefined;
  const isPublic = area === 's' || area === 'reset' || area === 'privacy';
  const misplaced = ready && !isPublic && (signedIn ? area === 'welcome' : area !== 'welcome');
  useEffect(() => {
    if (misplaced) router.replace(signedIn ? '/' : '/welcome');
  }, [misplaced, signedIn]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: color.paper }} />;

  const modal = { presentation: 'modal' } as const;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'none' }} />
        <Stack.Screen name="entry" options={modal} />
        <Stack.Screen name="recurring" options={modal} />
        <Stack.Screen name="transfer" options={modal} />
        <Stack.Screen name="rules" options={modal} />
        <Stack.Screen name="share" options={modal} />
        <Stack.Screen name="import" options={modal} />
        <Stack.Screen name="settings" options={modal} />
        <Stack.Screen name="property/[id]" />
        <Stack.Screen name="property/new" options={modal} />
        {/* Open to anyone holding the link or the reset email. */}
        <Stack.Screen name="s/[token]" />
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
        <T variant="small" color={color.onDark} numberOfLines={2}>
          {error}
        </T>
      </Pressable>
    </View>
  );
}
