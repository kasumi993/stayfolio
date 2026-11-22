/**
 * Which property a form writes to. Locked to the current space by default,
 * in the property's own colour, so it is obvious before saving.
 */
import { View } from 'react-native';

import { useData } from '@/data/store';
import { kindLabel, useLocale, useT } from '@/i18n';
import { Choice, Dot, TextLink } from '@/ui/controls';
import { Label } from '@/ui/fields';
import { T } from '@/ui/Text';
import { color, pigmentDot, pigmentOf, radius, space } from '@/ui/theme';

import type { PropertyChoice } from './hooks';

export function PropertyField({ choice, editing }: { choice: PropertyChoice; editing?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const property = data.properties.find((p) => p.id === choice.propertyId);

  if (choice.locked) {
    return (
      <View
        accessibilityLabel={t(`Logement : ${property?.name ?? 'aucun'}`, `Property: ${property?.name ?? 'none'}`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: pigmentOf(property?.color), borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Dot tint={pigmentDot(property?.color)} size={10} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="bodyBold" numberOfLines={1}>
            {property?.name ?? t('Mon activité, aucun logement', 'My business, no property')}
          </T>
          <T variant="small" color={color.inkSoft} numberOfLines={1}>
            {property ? kindLabel(property.kind, locale) : t('Frais généraux', 'General costs')}
          </T>
        </View>
        {choice.options.length > 1 ? <TextLink label={editing ? t('Déplacer', 'Move') : t('Changer', 'Change')} onPress={choice.unlock} /> : null}
      </View>
    );
  }
  return (
    <View>
      <Label>{t('Logement', 'Property')}</Label>
      <Choice value={choice.chosen ? choice.propertyId : '\u0000'} onChange={choice.setPropertyId} options={choice.options} />
      {!choice.chosen ? (
        <T variant="small" color={color.negative} style={{ marginTop: space.xs }}>
          {t('Choisis le logement avant d’enregistrer.', 'Pick the property before saving.')}
        </T>
      ) : null}
    </View>
  );
}
