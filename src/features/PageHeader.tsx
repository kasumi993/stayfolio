/**
 * Top of every main screen: its title, an optional ‹ › stepper (months,
 * years) and, on a phone, the property switcher and the settings button
 * (on a wide screen both live in the sidebar).
 */
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useStore } from '@/data/store';
import { kindLabel, useLocale, useT } from '@/i18n';
import { Dot, IconButton, Tag } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Sheet, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentDot, radius, space } from '@/ui/theme';

import { useSelection } from './hooks';

interface Stepper {
  onPrev: () => void;
  onNext: () => void;
  /** Jumps back to "now" when the title is tapped. */
  onReset?: () => void;
}

export function PageHeader({ title, subtitle, stepper, action, filter = true }: { title: string; subtitle?: string; stepper?: Stepper; action?: ReactNode; filter?: boolean }) {
  const t = useT();
  const wide = useWide();
  const demo = useStore((s) => s.backend.demo);
  const { property } = useSelection();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: space.xl }}>
      {!wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginBottom: space.md }}>
          {filter ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Changer de bien', 'Switch property')}
              onPress={() => setOpen(true)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: pressed ? color.sunken : color.surface, flexShrink: 1 })}>
              <Dot tint={pigmentDot(property?.color)} size={8} />
              <T variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                {property?.name ?? t('Tous les biens', 'All properties')}
              </T>
              <Icon name="down" size={14} color={color.inkSoft} />
            </Pressable>
          ) : (
            <View />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {demo ? <Tag label={t('Démo', 'Demo')} /> : null}
            <IconButton icon="gear" label={t('Réglages', 'Settings')} tint={color.inkSoft} onPress={() => router.push('/settings')} />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 }}>
          <Pressable disabled={!stepper?.onReset} onPress={stepper?.onReset} style={{ flexShrink: 1 }}>
            <T variant="title" numberOfLines={1}>
              {title}
            </T>
          </Pressable>
          {stepper ? (
            <View style={{ flexDirection: 'row', marginLeft: space.sm }}>
              <IconButton icon="left" label={t('Précédent', 'Previous')} tint={color.inkSoft} onPress={stepper.onPrev} />
              <IconButton icon="right" label={t('Suivant', 'Next')} tint={color.inkSoft} onPress={stepper.onNext} />
            </View>
          ) : null}
        </View>
        {action}
      </View>
      {subtitle ? (
        <T color={color.inkSoft} style={{ marginTop: 2 }}>
          {subtitle}
        </T>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Afficher', 'Show')}>
        <PropertyMenu onChosen={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

/** "All properties" and each property, as a list where one is selected. */
export function PropertyMenu({ onChosen, compact }: { onChosen?: () => void; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { property, active } = useSelection();
  const setProperty = useStore((s) => s.setProperty);
  const entries = [{ id: null as string | null, name: t('Tous les biens', 'All properties'), hint: t('Ce que l’ensemble me rapporte', 'What it all earns me'), tint: pigmentDot() }, ...active.map((p) => ({ id: p.id as string | null, name: p.name, hint: kindLabel(p.kind, locale), tint: pigmentDot(p.color) }))];
  return (
    <View style={{ gap: 2 }}>
      {entries.map((e) => {
        const selected = (property?.id ?? null) === e.id;
        return (
          <Pressable
            key={e.id ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={e.name}
            onPress={() => {
              setProperty(e.id);
              onChosen?.();
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: compact ? 7 : 11, paddingHorizontal: compact ? 10 : 12, borderRadius: radius.md, backgroundColor: selected || pressed ? color.sunken : 'transparent' })}>
            <Dot tint={e.tint} size={8} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant={selected ? 'bodyBold' : compact ? 'label' : 'bodyMedium'} numberOfLines={1} style={compact ? { fontSize: 13.5 } : undefined}>
                {e.name}
              </T>
              {!compact ? (
                <T variant="small" color={color.inkSoft} numberOfLines={1}>
                  {e.hint}
                </T>
              ) : null}
            </View>
            {selected && !compact ? <Icon name="check" size={16} color={color.positive} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
