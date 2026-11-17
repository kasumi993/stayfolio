/** Record money that moved: between me and an owner, or in and out of a partnership's cash. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { today } from '@/core/dates';
import { newId, now } from '@/core/id';
import { evalAmount } from '@/core/money';
import type { Transfer } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { usePartiesOf } from '@/features/hooks';
import { de, useT } from '@/i18n';
import { Button, Choice, ConfirmButton } from '@/ui/controls';
import { AmountField, DateFields, Field, Label } from '@/ui/fields';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, space } from '@/ui/theme';

export default function TransferScreen() {
  const params = useLocalSearchParams<{ property: string; id?: string }>();
  const t = useT();
  const data = useData();
  const { save, remove } = useStore.getState();
  const existing = data.transfers.find((x) => x.id === params.id);
  const parties = usePartiesOf(params.property);
  const me = parties.find((p) => p.is_me);
  const others = parties.filter((p) => !p.is_me);

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  // A partnership moves money in and out of the property's own cash, and I am
  // a partner like the others. Elsewhere, money moves between me and the other person.
  const pooled = data.properties.find((p) => p.id === params.property)?.kind === 'partnership';
  // Encoded as "<party id>:in" (they put money in, or paid me) or "<id>:out" (they were paid).
  const initial = () => {
    if (!existing) return pooled ? `${me?.id}:in` : `${others[0]?.id}:out`;
    if (pooled) {
      const giver = existing.from_party !== null && (existing.to_party === null || existing.to_party === me?.id);
      return giver ? `${existing.from_party}:in` : `${existing.to_party}:out`;
    }
    return existing.to_party === me?.id ? `${existing.from_party}:in` : `${existing.to_party}:out`;
  };
  const [direction, setDirection] = useState(initial);
  const [busy, setBusy] = useState(false);

  const value = evalAmount(amount);

  async function submit() {
    if (!value || !me) return;
    setBusy(true);
    const [other, way] = direction.split(':');
    const row: Transfer = {
      id: existing?.id ?? newId(),
      property_id: params.property,
      date,
      from_party: way === 'in' ? other : pooled ? null : me.id,
      to_party: way === 'in' ? (pooled ? null : me.id) : other,
      amount: value,
      note: note.trim(),
      created_at: existing?.created_at ?? now(),
    };
    try {
      await save('transfers', row);
      router.back();
    } catch {
      setBusy(false);
    }
  }

  return (
    <FormScreen title={existing ? t('Versement', 'Payment') : t('Noter un versement', 'Record a payment')} footer={<Button label={t('Enregistrer', 'Save')} onPress={submit} busy={busy} disabled={!value || value <= 0} />}>
      <View>
        <Label>{pooled ? t('Mouvement', 'Movement') : t('Sens', 'Direction')}</Label>
        <Choice
          value={direction}
          onChange={setDirection}
          options={
            pooled
              ? [
                  ...parties.map((p) => ({ value: `${p.id}:in`, label: p.is_me ? t('Mon apport', 'My contribution') : t(`Apport ${de(p.name)}`, `Paid in by ${p.name}`) })),
                  ...parties.map((p) => ({ value: `${p.id}:out`, label: p.is_me ? t('Versé à moi', 'Paid out to me') : t(`Versé à ${p.name}`, `Paid out to ${p.name}`) })),
                ]
              : others.flatMap((p) => [
                  { value: `${p.id}:out`, label: t(`J’ai versé à ${p.name}`, `I paid ${p.name}`) },
                  { value: `${p.id}:in`, label: t(`${p.name} m’a versé`, `${p.name} paid me`) },
                ])
          }
        />
      </View>
      {pooled ? (
        <T variant="small" color={color.inkSoft} style={{ marginTop: -space.sm }}>
          {t('Un apport entre dans la caisse du bien. Un versement en sort : c’est du bénéfice partagé.', 'A contribution goes into the property’s cash. A payment comes out of it: profit being shared.')}
        </T>
      ) : null}
      <AmountField label={t('Montant', 'Amount')} value={amount} onChangeText={setAmount} currency={data.profile.currency} autoFocus={!existing} />
      <DateFields items={[{ label: t('Date', 'Date'), value: date, onChange: (d) => d && setDate(d) }]} />
      <Field label={t('Note', 'Note')} value={note} onChangeText={setNote} placeholder={t('Reversement de novembre, apport, caution…', 'November payout, contribution, deposit…')} />
      {existing ? (
        <ConfirmButton
          label={t('Supprimer ce versement', 'Delete this payment')}
          confirmLabel={t('Confirmer la suppression', 'Confirm deletion')}
          onConfirm={() => {
            setBusy(true);
            void remove('transfers', existing.id).then(() => router.back());
          }}
        />
      ) : null}
    </FormScreen>
  );
}
