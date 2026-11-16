import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setPendingFile } from '@/features/pendingFile';
import { useT } from '@/i18n';
import { type PickedFile, pickDocument, takePhoto } from '@/platform/pick';
import { useStore } from '@/data/store';
import { Icon, type IconName } from '@/ui/Icon';
import { Sheet } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, maxWidth, radius, space } from '@/ui/theme';

const TABS: { name: string; icon: IconName; fr: string; en: string }[] = [
  { name: 'index', icon: 'month', fr: 'Mois', en: 'Month' },
  { name: 'properties', icon: 'home', fr: 'Biens', en: 'Places' },
  { name: 'reports', icon: 'chart', fr: 'Bilan', en: 'Reports' },
  { name: 'documents', icon: 'receipt', fr: 'Reçus', en: 'Receipts' },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

/** Four destinations and, in the middle, the one action used every day: add. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const hasProperty = useStore((s) => s.data.properties.some((p) => !p.archived));
  const current = state.routes[state.index]?.name;

  const tab = (item: (typeof TABS)[number]) => {
    const active = current === item.name;
    return (
      <Pressable
        key={item.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t(item.fr, item.en)}
        onPress={() => {
          const route = state.routes.find((r) => r.name === item.name);
          if (route) navigateToTab(route.key);
        }}
        style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
        <Icon name={item.icon} color={active ? color.ink : color.inkFaint} weight={active ? 2.4 : 2} />
        <T variant="small" color={active ? color.ink : color.inkFaint} style={active ? { fontFamily: 'HankenGrotesk_600SemiBold' } : undefined}>
          {t(item.fr, item.en)}
        </T>
      </Pressable>
    );
  };

  const go = (href: Parameters<typeof router.push>[0]) => {
    setAdding(false);
    router.push(href);
  };

  async function attach(pick: () => Promise<PickedFile | null>) {
    setAdding(false);
    try {
      const file = await pick();
      if (!file) return;
      setPendingFile(file);
      router.push({ pathname: '/entry', params: { type: 'expense', scan: '1' } });
    } catch {
      useStore.setState({ error: t('Accès à l’appareil photo refusé. Autorise-le dans les réglages.', 'Camera access was refused. Allow it in Settings.') });
    }
  }

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
      <View
        style={{
          width: '100%',
          maxWidth,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: color.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderTopWidth: 1,
          borderColor: color.line,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingHorizontal: space.sm,
        }}>
        {TABS.slice(0, 2).map(tab)}
        <View style={{ width: 76, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Ajouter', 'Add')}
            onPress={() => (hasProperty ? setAdding(true) : router.push('/property/new'))}
            style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 29, marginTop: -30, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: color.paper, opacity: pressed ? 0.85 : 1 })}>
            <Icon name="plus" size={26} color={color.accentInk} weight={2.6} />
          </Pressable>
        </View>
        {TABS.slice(2).map(tab)}
      </View>

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('Ajouter', 'Add')}>
        <View style={{ gap: space.sm }}>
          <AddOption icon="minus" tint={color.negative} title={t('Une dépense', 'An expense')} text={t('Ménage, électricité, achat…', 'Cleaning, electricity, a purchase…')} onPress={() => go({ pathname: '/entry', params: { type: 'expense' } })} />
          <AddOption icon="plus" tint={color.positive} title={t('Un revenu', 'Income')} text={t('Un versement Airbnb, Booking ou en direct', 'A payout from Airbnb, Booking or direct')} onPress={() => go({ pathname: '/entry', params: { type: 'booking' } })} />
          <AddOption icon="camera" title={t('Photographier un reçu', 'Photograph a receipt')} text={t('La dépense se remplit à partir de la photo', 'The expense is filled in from the photo')} onPress={() => void attach(takePhoto)} />
          <AddOption icon="file" title={t('Joindre un PDF ou une image', 'Attach a PDF or an image')} text={t('Une facture déjà sur le téléphone', 'An invoice already on the phone')} onPress={() => void attach(pickDocument)} />
        </View>
      </Sheet>
    </View>
  );
}

function AddOption({ icon, title, text, onPress, tint = color.ink }: { icon: IconName | 'minus'; title: string; text: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'minus' ? <View style={{ width: 14, height: 2.4, borderRadius: 2, backgroundColor: tint }} /> : <Icon name={icon} color={tint} />}
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyBold">{title}</T>
        <T variant="small" color={color.inkSoft}>
          {text}
        </T>
      </View>
    </Pressable>
  );
}
