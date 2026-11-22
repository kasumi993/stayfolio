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
import { Dot, IconButton, Tag, TextLink } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Sheet, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, fill, isOutline, pigmentDot, pigmentOf, radius, space } from '@/ui/theme';

import { useAccess, useSelection } from './hooks';

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
  const { access } = useAccess();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: space.xl }}>
      {!wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 40, marginBottom: space.lg }}>
          {access ? (
            // Through a member link: one property, and who shared it.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Dot tint={pigmentDot(property?.color)} size={8} />
              <View style={{ flexShrink: 1 }}>
                <T variant="label" numberOfLines={1}>
                  {property?.name ?? ''}
                </T>
                {access.ownerName && !access.preview ? (
                  <T variant="small" color={color.inkSoft} numberOfLines={1}>
                    {t(`Partagé par ${access.ownerName}`, `Shared by ${access.ownerName}`)}
                    {access.canEdit ? '' : t(', en lecture', ', read only')}
                  </T>
                ) : null}
              </View>
            </View>
          ) : filter ? (
            <SpaceCard onPress={() => setOpen(true)} />          ) : (
            <View />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {demo ? <Tag label={t('Démo', 'Demo')} /> : null}
            {access ? (
              null
            ) : (
              <IconButton icon="gear" label={t('Réglages', 'Settings')} tint={color.inkSoft} onPress={() => router.push('/settings')} />
            )}
          </View>
        </View>
      ) : null}

      {wide && filter && !access ? <SpaceLine /> : null}
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

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Changer de logement', 'Switch property')}>
        <PropertyMenu onChosen={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

/**
 * The space the app is in: one property, in its colour, or the overview of
 * all of them. Everything on screen and every new entry belongs to it.
 */
export function SpaceCard({ onPress, compact }: { onPress: () => void; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { property } = useSelection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`Logement affiché : ${property?.name ?? 'tous'}. Changer de logement`, `Showing: ${property?.name ?? 'all'}. Switch property`)}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: compact ? undefined : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: compact ? 10 : 9,
        paddingLeft: 12,
        paddingRight: 10,
        borderRadius: radius.lg,
        backgroundColor: property ? pigmentOf(property.color) : color.sunken,
        borderWidth: property && !isOutline() ? 0 : 1,
        borderColor: isOutline() ? color.ink : color.line,
        opacity: pressed ? 0.85 : 1,
        minWidth: 0,
      })}>
      {property ? (
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: pigmentDot(property.color), alignItems: 'center', justifyContent: 'center' }}>
          <T variant="bodyBold" color={color.paper} style={{ fontSize: 14, lineHeight: 18 }}>
            {initial(property.name)}
          </T>
        </View>
      ) : (
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="building" size={16} color={color.inkSoft} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="bodyBold" numberOfLines={1}>
          {property?.name ?? t('Tous les logements', 'All properties')}
        </T>
        <T variant="small" color={color.inkSoft} numberOfLines={1}>
          {property ? kindLabel(property.kind, locale) : t('Vue d’ensemble', 'Overview')}
        </T>
      </View>
      <Icon name="swap" size={18} color={color.inkSoft} />
    </Pressable>
  );
}

/** On a wide screen, above each page title: which property this page is about. */
function SpaceLine() {
  const t = useT();
  const { property } = useSelection();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: space.sm, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, ...fill(property ? pigmentOf(property.color) : color.sunken) }}>
      <Dot tint={pigmentDot(property?.color)} size={8} />
      <T variant="label">{property?.name ?? t('Tous les logements', 'All properties')}</T>
    </View>
  );
}

const initial = (name: string) => (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? '·').toUpperCase();

/** Each property, then the overview, then managing them. */
export function PropertyMenu({ onChosen }: { onChosen?: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { property, active } = useSelection();
  const setProperty = useStore((s) => s.setProperty);
  const pick = (id: string | null) => {
    setProperty(id);
    onChosen?.();
  };
  const go = (path: '/properties' | '/property-form') => {
    onChosen?.();
    router.push(path);
  };
  return (
    <View style={{ gap: space.sm }}>
      {active.map((p) => {
        const selected = property?.id === p.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={p.name}
            onPress={() => pick(p.id)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: pigmentOf(p.color), borderWidth: 2, borderColor: selected ? pigmentDot(p.color) : isOutline() ? color.line : 'transparent', opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: pigmentDot(p.color), alignItems: 'center', justifyContent: 'center' }}>
              <T variant="bodyBold" color={color.paper}>
                {initial(p.name)}
              </T>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="bodyBold" numberOfLines={1}>
                {p.name}
              </T>
              <T variant="small" color={color.inkSoft} numberOfLines={1}>
                {[kindLabel(p.kind, locale), p.location].filter(Boolean).join(', ')}
              </T>
            </View>
            {selected ? <Icon name="check" size={18} color={color.ink} /> : null}
          </Pressable>
        );
      })}
      {active.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !property }}
          accessibilityLabel={t('Tous les logements', 'All properties')}
          onPress={() => pick(null)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: !property ? 2 : 1, borderColor: !property ? color.ink : color.line, backgroundColor: pressed ? color.sunken : color.surface })}>
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="building" size={17} color={color.inkSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="bodyBold">{t('Tous les logements', 'All properties')}</T>
            <T variant="small" color={color.inkSoft}>
              {t('Le cumul, pour regarder. Pour saisir, entre dans un logement.', 'The total, to look at. To record, open a property.')}
            </T>
          </View>
          {!property ? <Icon name="check" size={18} color={color.ink} /> : null}
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm, paddingHorizontal: 4 }}>
        <TextLink label={t('Gérer les logements', 'Manage properties')} onPress={() => go('/properties')} />
        <TextLink label={t('Ajouter un logement', 'Add a property')} onPress={() => go('/property-form')} />
      </View>
    </View>
  );
}
