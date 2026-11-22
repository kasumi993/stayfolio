/**
 * The frame around the main screens: a bottom tab bar on a phone, a sidebar on
 * a wide screen. Both offer the same four destinations and the "add" action.
 */
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { useAccess, useSelection } from '@/features/hooks';
import { InstallBanner } from '@/features/InstallBanner';
import { MemberBar } from '@/features/MemberBar';
import { PropertyMenu, SpaceCard } from '@/features/PageHeader';
import { setPendingFile } from '@/features/pendingFile';
import { useT } from '@/i18n';
import { type PickedFile, pickDocument, takePhoto } from '@/platform/pick';
import { Button, Tag } from '@/ui/controls';
import { Icon, type IconName } from '@/ui/Icon';
import { Sheet, useWide } from '@/ui/layout';
import { Logo } from '@/ui/Logo';
import { T } from '@/ui/Text';
import { color, maxWidth, radius, space } from '@/ui/theme';

/**
 * The four destinations, all inside the space chosen at the top (one
 * property, or the overview). Recording income and expenses comes first.
 */
const TABS: { name: string; icon: IconName; fr: string; en: string }[] = [
  { name: 'index', icon: 'home', fr: 'Accueil', en: 'Home' },
  { name: 'entries', icon: 'list', fr: 'Saisies', en: 'Entries' },
  { name: 'calendar', icon: 'month', fr: 'Calendrier', en: 'Calendar' },
  { name: 'documents', icon: 'receipt', fr: 'Factures', en: 'Invoices' },
];
/** Reached from the home screen and the space switcher; listed in the sidebar on a computer. */
const MORE: { name: string; icon: IconName; fr: string; en: string }[] = [
  { name: 'reports', icon: 'chart', fr: 'Bilan', en: 'Reports' },
  { name: 'properties', icon: 'building', fr: 'Logements', en: 'Properties' },
];
const REPORTS = MORE[0];

export default function TabsLayout() {
  const wide = useWide();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: color.paper } }}
      tabBar={(props) => <Navigation {...props} wide={wide} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="properties" />
      {/* A property's page: part of "Places", not a destination of its own. */}
      <Tabs.Screen name="property" />
    </Tabs>
  );
}

function Navigation({ state, navigateToTab, wide }: BottomTabBarProps & { wide: boolean }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const [switching, setSwitching] = useState(false);
  const space_ = useSelection().property;
  const hasProperty = useStore((s) => s.data.properties.some((p) => !p.archived));
  const demo = useStore((s) => s.backend.demo);
  const { owner, canEdit, sees } = useAccess();
  const routeName = state.routes[state.index]?.name;
  const current = routeName === 'property' ? 'properties' : routeName;
  // Through a member link: only the pages the owner allowed, the report in
  // place of the property list, and adding only if allowed.
  const tabs = owner
    ? TABS
    : [TABS[0], ...(sees('income') || sees('expenses') ? [TABS[1]] : []), ...(sees('income') ? [TABS[2]] : []), ...(sees('invoices') ? [TABS[3]] : []), ...(sees('report') ? [REPORTS] : [])];
  const more = owner ? MORE : [];
  const canAdd = canEdit && (owner || sees('income') || sees('expenses') || sees('invoices'));

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

  async function fileInvoice() {
    setAdding(false);
    try {
      const file = await pickDocument();
      if (!file) return;
      setPendingFile(file);
      router.push({ pathname: '/invoice', params: { new: '1' } });
    } catch {
      useStore.setState({ error: t('Le fichier n’a pas pu être ouvert.', 'The file could not be opened.') });
    }
  }

  const sheet = (
    <>
    <Sheet open={switching} onClose={() => setSwitching(false)} title={t('Changer de logement', 'Switch property')}>
      <PropertyMenu onChosen={() => setSwitching(false)} />
    </Sheet>
    <Sheet open={adding} onClose={() => setAdding(false)} title={space_ ? t(`Ajouter dans ${space_.name}`, `Add to ${space_.name}`) : t('Ajouter', 'Add')}>
      <View style={{ gap: 2 }}>
        {owner && !space_ && hasProperty ? (
          <T variant="small" color={color.inkSoft} style={{ marginBottom: space.sm }}>
            {t('Tu es dans la vue d’ensemble : le formulaire te demandera le logement.', 'You are in the overview: the form will ask for the property.')}
          </T>
        ) : null}
        {sees('expenses') ? <AddOption icon="minus" tint={color.negative} bg={color.tintExpense} title={t('Une dépense', 'An expense')} text={t('Ménage, électricité, achat…', 'Cleaning, electricity, a purchase…')} onPress={() => open({ pathname: '/entry', params: { type: 'expense' } })} /> : null}
        {sees('income') ? <AddOption icon="plus" tint={color.positive} bg={color.tintIncome} title={t('Un revenu', 'Income')} text={t('Un versement Airbnb, Booking ou en direct', 'A payout from Airbnb, Booking or direct')} onPress={() => open({ pathname: '/entry', params: { type: 'booking' } })} /> : null}
        {owner ? <AddOption icon="camera" bg={color.tintOccupancy} title={t('Photographier un reçu', 'Photograph a receipt')} text={t('La dépense se remplit à partir de la photo', 'The expense is filled in from the photo')} onPress={() => void attach(takePhoto)} /> : null}
        {sees('invoices') ? <AddOption icon="file" bg={color.tintNight} title={t('Ranger une facture', 'File an invoice')} text={t('Seule, ou rattachée plus tard à une dépense', 'On its own, or linked to an expense later')} onPress={() => void fileInvoice()} /> : null}
      </View>
    </Sheet>
    </>
  );

  if (wide) {
    return (
      <View style={{ width: 248, backgroundColor: color.sunken, borderRightWidth: 1, borderRightColor: color.line, paddingTop: space.xl, paddingBottom: space.lg, paddingHorizontal: space.lg }}>
        <View style={{ paddingHorizontal: 6, marginBottom: space.xl }}>
          <Logo size={26} />
        </View>
        {hasProperty && owner ? (
          <View style={{ marginBottom: space.md }}>
            <SpaceCard compact onPress={() => setSwitching(true)} />
          </View>
        ) : null}
        {canAdd ? <Button icon="plus" label={t('Ajouter', 'Add')} onPress={add} /> : null}
        <View style={{ gap: 2, marginTop: canAdd ? space.xl : 0 }}>
          {[...tabs, ...more].map((item) => {
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
        <View style={{ flex: 1 }} />
        <View style={{ marginTop: space.md }}>
          <InstallBanner compact />
        </View>
        {owner ? null : (
          <View style={{ marginTop: space.md }}>
            <MemberBar compact />
          </View>
        )}
        {owner ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Réglages', 'Settings')} onPress={() => router.push('/settings')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: pressed ? color.line : 'transparent', flex: 1 })}>
            <Icon name="gear" size={19} color={color.inkSoft} />
            <T variant="bodyMedium" color={color.inkSoft}>
              {t('Réglages', 'Settings')}
            </T>
          </Pressable>
          {demo ? <Tag label={t('Démo', 'Demo')} /> : null}
        </View>
        ) : null}
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
      <View pointerEvents="box-none" style={{ width: '100%', maxWidth, paddingHorizontal: space.md, paddingBottom: space.sm }}>
        {owner ? <InstallBanner /> : <MemberBar />}
      </View>
      <View style={{ width: '100%', maxWidth, flexDirection: 'row', alignItems: 'center', backgroundColor: color.paper, borderTopWidth: 1, borderColor: color.line, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: space.sm }}>
        {tabs.slice(0, 2).map(tab)}
        {canAdd ? (
        <View style={{ width: 72, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Ajouter', 'Add')}
            onPress={add}
            style={({ pressed }) => ({ width: 50, height: 50, borderRadius: radius.lg, marginTop: -22, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: color.paper, opacity: pressed ? 0.85 : 1 })}>
            <Icon name="plus" size={22} color={color.accentInk} weight={2.4} />
          </Pressable>
        </View>
        ) : null}
        {tabs.slice(2).map(tab)}
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
