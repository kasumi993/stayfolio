/**
 * Create a property, or edit its basic settings with ?id=…
 * The arrangement picked here only pre-fills the rules; they stay editable.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { currentMonth } from '@/core/dates';
import { newId, now } from '@/core/id';
import { evalAmount } from '@/core/money';
import type { Party, Property, PropertyKind, Rule } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { usePartiesOf } from '@/features/hooks';
import { kindLabel, useLocale, useT } from '@/i18n';
import { Button, Choice, ConfirmButton } from '@/ui/controls';
import { Field, Label } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentKeys, pigmentOf, space } from '@/ui/theme';

const KINDS: PropertyKind[] = ['owned', 'partnership', 'managed'];

export default function PropertyForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const { save, remove, setProperty } = useStore.getState();
  const existing = data.properties.find((p) => p.id === id);
  const parties = usePartiesOf(existing?.id);

  const [name, setName] = useState(existing?.name ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [tint, setTint] = useState(existing?.color ?? pigmentKeys[data.properties.length % pigmentKeys.length]);
  const [kind, setKind] = useState<PropertyKind>(existing?.kind ?? 'owned');
  const [basis, setBasis] = useState(existing?.revenue_basis ?? 'checkin');
  const [payout, setPayout] = useState(existing?.payout_party_id ?? null);
  const [other, setOther] = useState('');
  const [mine, setMine] = useState('60');
  const [commission, setCommission] = useState('13');
  const [busy, setBusy] = useState(false);

  const needsOther = !existing && kind !== 'owned';
  const valid = name.trim() && (!needsOther || other.trim());

  async function submit() {
    setBusy(true);
    const property: Property = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      location: location.trim(),
      kind,
      color: tint,
      revenue_basis: basis,
      payout_party_id: payout,
      archived: existing?.archived ?? false,
      created_at: existing?.created_at ?? now(),
    };
    try {
      await save('properties', property);
      if (!existing) {
        const me: Party = { id: newId(), property_id: property.id, name: data.profile.name || t('Moi', 'Me'), is_me: true };
        const partner: Party | null = kind === 'owned' ? null : { id: newId(), property_id: property.id, name: other.trim(), is_me: false };
        const share = Math.min(Math.max((evalAmount(mine) ?? 50) / 100, 0), 1);
        const rule: Rule = {
          id: newId(),
          property_id: property.id,
          effective_from: currentMonth(),
          commission_rate: kind === 'managed' ? Math.min(Math.max((evalAmount(commission) ?? 0) / 100, 0), 1) : 0,
          shares:
            kind === 'owned' || !partner
              ? [{ party_id: me.id, revenue: 1, expense: 1 }]
              : kind === 'partnership'
                ? [
                    { party_id: me.id, revenue: share, expense: share },
                    { party_id: partner.id, revenue: 1 - share, expense: 1 - share },
                  ]
                : [
                    { party_id: me.id, revenue: 0, expense: 0 },
                    { party_id: partner.id, revenue: 1, expense: 1 },
                  ],
        };
        await save('parties', partner ? [me, partner] : [me]);
        await save('rules', rule);
        setProperty(property.id);
        router.replace({ pathname: '/property/[id]', params: { id: property.id } });
      } else router.back();
    } catch {
      setBusy(false);
    }
  }

  return (
    <FormScreen title={existing ? t('Réglages du bien', 'Property settings') : t('Nouveau bien', 'New property')} footer={<Button label={t('Enregistrer', 'Save')} onPress={submit} busy={busy} disabled={!valid} />}>
      <Field label={t('Nom', 'Name')} value={name} onChangeText={setName} placeholder="Studio Mermoz" autoFocus={!existing} />
      <Field label={t('Ville ou quartier', 'City or area')} value={location} onChangeText={setLocation} placeholder="Dakar" />

      <View>
        <Label>{t('Couleur', 'Colour')}</Label>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {pigmentKeys.map((key) => (
            <Pressable key={key} accessibilityLabel={key} onPress={() => setTint(key)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: pigmentOf(key), alignItems: 'center', justifyContent: 'center' }}>
              {tint === key ? <Icon name="check" color={color.white} weight={3} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {!existing ? (
        <>
          <View>
            <Label>{t('Ce bien est…', 'This place is…')}</Label>
            <Choice value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: kindLabel(k, locale) }))} />
          </View>
          {kind === 'partnership' ? (
            <>
              <Field label={t('Nom de mon associé·e', 'My partner’s name')} value={other} onChangeText={setOther} />
              <Field label={t('Ma part du résultat (%)', 'My share of the result (%)')} value={mine} onChangeText={setMine} keyboardType="numbers-and-punctuation" />
            </>
          ) : null}
          {kind === 'managed' ? (
            <>
              <Field label={t('Nom du propriétaire', 'Owner’s name')} value={other} onChangeText={setOther} />
              <Field label={t('Ma commission sur chaque réservation (%)', 'My commission on each booking (%)')} value={commission} onChangeText={setCommission} keyboardType="numbers-and-punctuation" />
            </>
          ) : null}
          {kind !== 'owned' ? (
            <T variant="small" color={color.inkSoft}>
              {t('Ce sont des valeurs de départ. Les parts de revenus et de dépenses se règlent ensuite séparément, et peuvent changer d’un mois à l’autre.', 'These are starting values. Income and expense shares can then be set separately, and can change from one month to the next.')}
            </T>
          ) : null}
        </>
      ) : (
        <>
          <View>
            <Label>{t('Un revenu compte dans le mois…', 'Income counts in the month…')}</Label>
            <Choice
              value={basis}
              onChange={setBasis}
              options={[
                { value: 'checkin', label: t('de l’arrivée du voyageur', 'the guest arrives') },
                { value: 'received', label: t('où le versement arrive', 'the payout arrives') },
              ]}
            />
          </View>
          {parties.length > 1 ? (
            <View>
              <Label>{t('Les versements des plateformes arrivent chez', 'Platform payouts go to')}</Label>
              <Choice value={payout} onChange={setPayout} options={parties.map((p) => ({ value: p.is_me ? null : p.id, label: p.is_me ? t('Moi', 'Me') : p.name }))} />
            </View>
          ) : null}
          <Button
            tone="quiet"
            label={existing.archived ? t('Sortir des archives', 'Unarchive') : t('Archiver ce bien', 'Archive this property')}
            onPress={() => void save('properties', { ...existing, archived: !existing.archived }).then(() => router.back())}
          />
          <ConfirmButton
            label={t('Supprimer ce bien et toutes ses écritures', 'Delete this property and all its entries')}
            confirmLabel={t('Tout supprimer définitivement', 'Delete everything for good')}
            onConfirm={() => {
              setBusy(true);
              setProperty(null);
              void remove('properties', existing.id).then(() => router.dismissTo('/properties'));
            }}
          />
        </>
      )}
    </FormScreen>
  );
}
