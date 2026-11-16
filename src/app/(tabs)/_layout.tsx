/**
 * The frame around the main screens: a bottom tab bar on a phone, a sidebar on
 * a wide screen. Both offer the same four destinations and the "add" action.
 */
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { PropertyMenu } from '@/features/PageHeader';
import { setPendingFile } from '@/features/pendingFile';
import { useT } from '@/i18n';
import { type PickedFile, pickDocument, takePhoto } from '@/platform/pick';
import { Button, Tag } from '@/ui/controls';
import { Icon, type IconName } from '@/ui/Icon';
import { Sheet, useWide } from '@/ui/layout';
import { Logo } from '@/ui/Logo';
import { T } from '@/ui/Text';
import { color, maxWidth, radius, space } from '@/ui/theme';

const TABS: { name: string; icon: IconName; fr: string; en: string }[] = [
  { name: 'index', icon: 'month', fr: 'Mois', en: 'Month' },
  { name: 'properties', icon: 'home', fr: 'Biens', en: 'Places' },
  { name: 'reports', icon: 'chart', fr: 'Bilan', en: 'Reports' },
  { name: 'documents', icon: 'receipt', fr: 'Reçus', en: 'Receipts' },
];

export default function TabsLayout() {
  const wide = useWide();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: color.paper } }}
      tabBar={(props) => <Navigation {...props} wide={wide} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
      {/* A property's page: part of "Places", not a destination of its own. */}
      <Tabs.Screen name="property" />
    </Tabs>
  );
}

function Navigation({ state, navigateToTab, wide }: BottomTabBarProps & { wide: boolean }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const hasProperty = useStore((s) => s.data.properties.some((p) => !p.archived));
  const demo = useStore((s) => s.backend.demo);
  const routeName = state.routes[state.index]?.name;
  const current = routeName === 'property' ? 'properties' : routeName;

  const goTo = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };
  const add = () => (hasProperty ? setAdding(true) : router.push('/property-form'));
  const open = (href: Parameters<typeof router.push>[0]) => {
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

  const sheet = (
    <Sheet open={adding} onClose={() => setAdding(false)} title={t('Ajouter', 'Add')}>
      <View style={{ gap: 2 }}>
        <AddOption icon="minus" tint={color.negative} bg={color.tintExpense} title={t('Une dépense', 'An expense')} text={t('Ménage, électricité, achat…', 'Cleaning, electricity, a purchase…')} onPress={() => open({ pathname: '/entry', params: { type: 'expense' } })} />
        <AddOption icon="plus" tint={color.positive} bg={color.tintIncome} title={t('Un revenu', 'Income')} text={t('Un versement Airbnb, Booking ou en direct', 'A payout from Airbnb, Booking or direct')} onPress={() => open({ pathname: '/entry', params: { type: 'booking' } })} />
        <AddOption icon="camera" bg={color.tintOccupancy} title={t('Photographier un reçu', 'Photograph a receipt')} text={t('La dépense se remplit à partir de la photo', 'The expense is filled in from the photo')} onPress={() => void attach(takePhoto)} />
        <AddOption icon="file" bg={color.tintNight} title={t('Joindre un PDF ou une image', 'Attach a PDF or an image')} text={t('Une facture déjà enregistrée', 'An invoice already saved')} onPress={() => void attach(pickDocument)} />
      </View>
    </Sheet>
  );

  if (wide) {
    return (
      <View style={{ width: 248, backgroundColor: color.sunken, borderRightWidth: 1, borderRightColor: color.line, paddingTop: space.xl, paddingBottom: space.lg, paddingHorizontal: space.lg }}>
        <View style={{ paddingHorizontal: 6, marginBottom: space.xl }}>
          <Logo size={26} />
        </View>
        <Button icon="plus" label={t('Ajouter', 'Add')} onPress={add} />
        <View style={{ gap: 2, marginTop: space.xl }}>
          {TABS.map((item) => {
            const active = current === item.name;
            return (
              <Pressable
                key={item.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(item.fr, item.en)}
                onPress={() => goTo(item.name)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: active ? color.surface : pressed ? color.line : 'transparent', borderWidth: 1, borderColor: active ? color.line : 'transparent' })}>
                <Icon name={item.icon} size={19} color={active ? color.ink : color.inkSoft} />
                <T variant={active ? 'bodyBold' : 'bodyMedium'} color={active ? color.ink : color.inkSoft}>
                  {t(item.fr, item.en)}
                </T>
              </Pressable>
            );
          })}
        </View>
        {hasProperty ? (
          <ScrollView style={{ marginTop: space.xl, flex: 1 }}>
            <T variant="small" color={color.inkFaint} style={{ paddingHorizontal: 10, marginBottom: 6 }}>
              {t('Afficher', 'Show')}
            </T>
            <PropertyMenu compact />
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Réglages', 'Settings')} onPress={() => router.push('/settings')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: pressed ? color.line : 'transparent', flex: 1 })}>
            <Icon name="gear" size={19} color={color.inkSoft} />
            <T variant="bodyMedium" color={color.inkSoft}>
              {t('Réglages', 'Settings')}
            </T>
          </Pressable>
          {demo ? <Tag label={t('Démo', 'Demo')} /> : null}
        </View>
        {sheet}
      </View>
    );
  }

  const tab = (item: (typeof TABS)[number]) => {
    const active = current === item.name;
    return (
      <Pressable key={item.name} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t(item.fr, item.en)} onPress={() => goTo(item.name)} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
        <Icon name={item.icon} size={21} color={active ? color.ink : color.inkFaint} weight={active ? 2.2 : 1.9} />
        <T variant="small" color={active ? color.ink : color.inkFaint} style={active ? { fontFamily: 'PlusJakartaSans_600SemiBold' } : undefined}>
          {t(item.fr, item.en)}
        </T>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth, flexDirection: 'row', alignItems: 'center', backgroundColor: color.paper, borderTopWidth: 1, borderColor: color.line, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: space.sm }}>
        {TABS.slice(0, 2).map(tab)}
        <View style={{ width: 72, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Ajouter', 'Add')}
            onPress={add}
            style={({ pressed }) => ({ width: 50, height: 50, borderRadius: radius.lg, marginTop: -22, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: color.paper, opacity: pressed ? 0.85 : 1 })}>
            <Icon name="plus" size={22} color={color.accentInk} weight={2.4} />
          </Pressable>
        </View>
        {TABS.slice(2).map(tab)}
      </View>
      {sheet}
    </View>
  );
}

function AddOption({ icon, title, text, onPress, tint = color.ink, bg }: { icon: IconName | 'minus'; title: string; text: string; onPress: () => void; tint?: string; bg: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: pressed ? color.sunken : 'transparent' })}>
      <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        {icon === 'minus' ? <View style={{ width: 13, height: 2.2, borderRadius: 2, backgroundColor: tint }} /> : <Icon name={icon} color={tint} size={19} />}
      </View>
      <View style={{ flex: 1 }}>
        <T variant="bodyMedium">{title}</T>
        <T variant="small" color={color.inkSoft}>
          {text}
        </T>
      </View>
    </Pressable>
  );
}
