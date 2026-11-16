/**
 * The coloured panel at the top of the main tabs. It carries the property
 * switcher, so the same filter follows the user from tab to tab.
 */
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { kindLabel, useLocale, useT } from '@/i18n';
import { Dot, IconButton, Row } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block, Column, Sheet } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentDot, radius, space } from '@/ui/theme';

import { useSelection } from './hooks';

export function Hero({ children }: { children: ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const { property, tint, active } = useSelection();
  const setProperty = useStore((s) => s.setProperty);
  const demo = useStore((s) => s.backend.demo);
  const [open, setOpen] = useState(false);

  const choose = (id: string | null) => {
    setProperty(id);
    setOpen(false);
  };

  return (
    <View style={{ backgroundColor: tint, paddingTop: insets.top + space.sm, paddingBottom: space.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, marginBottom: space.sm }}>
      <Column>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Changer de bien', 'Switch property')}
            onPress={() => setOpen(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingRight: 12, opacity: pressed ? 0.6 : 1, flexShrink: 1 })}>
            <T variant="bodyBold" color={color.onHero} numberOfLines={1}>
              {property?.name ?? t('Tous les biens', 'All properties')}
            </T>
            <Icon name="down" size={16} color={color.onHero} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {demo ? (
              <View style={{ paddingHorizontal: 10, height: 26, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.heroTrack }}>
                <T variant="small" color={color.onHero}>
                  {t('Démo', 'Demo')}
                </T>
              </View>
            ) : null}
            <IconButton icon="gear" label={t('Réglages', 'Settings')} tint={color.onHero} onPress={() => router.push('/settings')} />
          </View>
        </View>
        {children}
      </Column>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Afficher', 'Show')}>
        <Block>
          <Row title={t('Tous les biens', 'All properties')} subtitle={t('Ce que l’ensemble me rapporte', 'What it all earns me')} leading={<Dot tint={pigmentDot()} size={14} />} onPress={() => choose(null)} last={!active.length} />
          {active.map((p, i) => (
            <Row key={p.id} title={p.name} subtitle={kindLabel(p.kind, locale)} leading={<Dot tint={pigmentDot(p.color)} size={14} />} onPress={() => choose(p.id)} last={i === active.length - 1} />
          ))}
        </Block>
      </Sheet>
    </View>
  );
}

/** ‹ Novembre 2026 › */
export function Stepper({ label, onPrev, onNext, onLabelPress }: { label: string; onPrev: () => void; onNext: () => void; onLabelPress?: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginLeft: -10, marginTop: space.xs }}>
      <IconButton icon="left" label={t('Précédent', 'Previous')} tint={color.onHero} onPress={onPrev} />
      <Pressable disabled={!onLabelPress} onPress={onLabelPress} hitSlop={8}>
        <T variant="label" color={color.onHero} align="center" style={{ minWidth: 126 }}>
          {label}
        </T>
      </Pressable>
      <IconButton icon="right" label={t('Suivant', 'Next')} tint={color.onHero} onPress={onNext} />
    </View>
  );
}

/** Three small figures side by side, on the coloured panel. */
export function HeroFacts({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: space.lg }}>
      {facts.map((f, i) => (
        <View key={f.label} style={{ flex: 1, paddingLeft: i ? space.md : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: color.heroTrack }}>
          <T variant="small" color={color.onHeroSoft} numberOfLines={1}>
            {f.label}
          </T>
          <T variant="figure" color={color.onHero} tabular numberOfLines={1} adjustsFontSizeToFit>
            {f.value}
          </T>
        </View>
      ))}
    </View>
  );
}
