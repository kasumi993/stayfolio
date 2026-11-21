/**
 * Offers to install the web version on the home screen. One tap on Android
 * and computers; on iPhone, the two steps to follow in Safari.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { type InstallWay, bannerDismissed, dismissBanner, promptInstall, useInstallWay } from '@/platform/install';
import { Button } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { useWide } from '@/ui/layout';
import { Logo } from '@/ui/Logo';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export function InstallBanner({ compact }: { compact?: boolean }) {
  const t = useT();
  const way = useInstallWay();
  const [hidden, setHidden] = useState(bannerDismissed);
  if (way === 'none' || hidden) return null;
  const close = () => {
    dismissBanner();
    setHidden(true);
  };
  return (
    <View style={{ backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: compact ? space.md : 14, gap: space.sm, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyBold">{t('Installer Stayfolio', 'Install Stayfolio')}</T>
          <InstallSteps way={way} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Plus tard', 'Not now')} onPress={close} hitSlop={10} style={{ padding: 2 }}>
          <Icon name="close" size={18} color={color.inkFaint} />
        </Pressable>
      </View>
      {way === 'prompt' ? <Button compact label={t('Installer', 'Install')} icon="download" onPress={() => void promptInstall()} /> : null}
    </View>
  );
}

/** What to do on this device, in one or two short lines. */
export function InstallSteps({ way }: { way: InstallWay }) {
  const t = useT();
  const wide = useWide();
  if (way === 'ios') {
    return (
      <View style={{ gap: 4 }}>
        <T variant="small" color={color.inkSoft}>
          {t('Dans Safari, touche', 'In Safari, tap')} <Icon name="share" size={13} color={color.inkSoft} /> {t('Partager, puis « Sur l’écran d’accueil ».', 'Share, then “Add to Home Screen”.')}
        </T>
        <T variant="small" color={color.inkFaint}>
          {t('L’app s’ouvre ensuite en plein écran, comme les autres.', 'It then opens full screen, like your other apps.')}
        </T>
      </View>
    );
  }
  return (
    <T variant="small" color={color.inkSoft}>
      {wide
        ? t('Une fenêtre à part, sans barre de navigateur, lancée depuis ton dock ou ta barre des tâches.', 'Its own window, without the browser bar, opened from your dock or taskbar.')
        : t('Une icône sur ton écran d’accueil, l’app en plein écran, et l’ajout rapide d’une dépense en appui long sur l’icône.', 'An icon on your home screen, the app full screen, and quick add of an expense with a long press on the icon.')}
    </T>
  );
}

/** Settings row: install later, after the banner was dismissed. */
export function InstallSetting() {
  const t = useT();
  const way = useInstallWay();
  if (way === 'none') return null;
  return (
    <View style={{ gap: space.sm, flexDirection: 'row', alignItems: 'center' }}>
      <Logo size={22} withName={false} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyMedium">{t('Installer sur cet appareil', 'Install on this device')}</T>
        <InstallSteps way={way} />
      </View>
      {way === 'prompt' ? <Button compact tone="quiet" label={t('Installer', 'Install')} onPress={() => void promptInstall()} /> : null}
    </View>
  );
}
