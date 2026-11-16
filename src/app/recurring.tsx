/** Set up an expense that comes back every month (rent, internet…). */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addMonths, currentMonth } from '@/core/dates';
import { newId, now } from '@/core/id';
import { evalAmount } from '@/core/money';
import { CATEGORIES, type Recurring } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { Stepper } from '@/features/MonthStepper';
import { categoryLabel, monthLabel, useLocale, useT } from '@/i18n';
import { Button, Choice, ConfirmButton, Toggle } from '@/ui/controls';
import { AmountField, Field, Label } from '@/ui/fields';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export default function RecurringScreen() {
  const params = useLocalSearchParams<{ property?: string; id?: string }>();
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const { save, remove, syncRecurring } = useStore.getState();
  const existing = data.recurring.find((r) => r.id === params.id);
  const profile = data.profile;

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? profile.currency);
  const [category, setCategory] = useState(existing?.category ?? 'rent');
  const [vendor, setVendor] = useState(existing?.vendor ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [day, setDay] = useState(String(existing?.day ?? 1));
  const [start, setStart] = useState(existing?.start_month ?? currentMonth());
  const [end, setEnd] = useState(existing?.end_month ?? null);
  const [isPrivate, setPrivate] = useState(existing?.scope === 'private');
  const [busy, setBusy] = useState(false);

  const value = evalAmount(amount);
  const generated = existing ? data.expenses.filter((x) => x.recurring_id === existing.id).length : 0;

  async function submit() {
    if (value === null) return;
    setBusy(true);
    const row: Recurring = {
      id: existing?.id ?? newId(),
      property_id: existing ? existing.property_id : (params.property ?? null),
      category,
      vendor: vendor.trim(),
      description: description.trim() || categoryLabel(category, locale),
      currency,
      amount: value,
      fx_rate: currency === profile.currency ? 1 : (profile.fx[currency] ?? 1),
      scope: isPrivate ? 'private' : 'property',
      paid_by: existing?.paid_by ?? null,
      day: Math.min(Math.max(Math.round(evalAmount(day) ?? 1), 1), 28),
      start_month: start,
      end_month: end,
      created_at: existing?.created_at ?? now(),
    };
    try {
      await save('recurring', row);
      await syncRecurring();
      router.back();
    } catch {
      setBusy(false);
    }
  }

  return (
    <FormScreen title={existing ? t('Dépense récurrente', 'Recurring expense') : t('Nouvelle dépense récurrente', 'New recurring expense')} footer={<Button label={t('Enregistrer', 'Save')} onPress={submit} busy={busy} disabled={value === null || value === 0} />}>
      <AmountField label={t('Montant chaque mois', 'Amount each month')} value={amount} onChangeText={setAmount} currency={currency} autoFocus={!existing} />
      <Choice value={currency} onChange={setCurrency} options={['XOF', 'EUR', 'USD'].map((c) => ({ value: c, label: c }))} />
      <View>
        <Label>{t('Catégorie', 'Category')}</Label>
        <Choice value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c as string, label: categoryLabel(c, locale) }))} />
      </View>
      <Field label={t('Fournisseur', 'Vendor')} value={vendor} onChangeText={setVendor} />
      <Field label={t('Libellé', 'Label')} value={description} onChangeText={setDescription} placeholder={categoryLabel(category, locale)} />
      <Field label={t('Jour du mois (1 à 28)', 'Day of the month (1 to 28)')} value={day} onChangeText={setDay} keyboardType="number-pad" />

      <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
        <View>
          <Label>{t('Premier mois', 'First month')}</Label>
          <Stepper label={monthLabel(start, locale)} onPrev={() => setStart(addMonths(start, -1))} onNext={() => setStart(addMonths(start, 1))} />
        </View>
        <Toggle value={end !== null} onChange={(on) => setEnd(on ? (start > currentMonth() ? start : currentMonth()) : null)} label={t('Prévoir une fin', 'Set an end')} hint={t('Sinon elle continue jusqu’à ce que tu l’arrêtes.', 'Otherwise it continues until you stop it.')} />
        {end !== null ? (
          <View>
            <Label>{t('Dernier mois', 'Last month')}</Label>
            <Stepper label={monthLabel(end, locale)} onPrev={() => setEnd(addMonths(end, -1) < start ? start : addMonths(end, -1))} onNext={() => setEnd(addMonths(end, 1))} />
          </View>
        ) : null}
      </View>

      <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg }}>
        <Toggle value={isPrivate} onChange={setPrivate} label={t('Dépense privée', 'Private expense')} hint={t('À ma charge, hors des comptes du bien.', 'Mine to bear, outside the property books.')} />
      </View>

      <T variant="small" color={color.inkSoft}>
        {existing
          ? t(`Déjà ajoutée ${generated} fois. Les mois passés ne changent pas : pour en exclure un, ouvre la dépense dans ce mois-là.`, `Added ${generated} times so far. Past months do not change: to skip one, open the expense in that month.`)
          : t('Elle s’ajoutera seule chaque mois, à partir du premier mois choisi. Tu pourras exclure un mois précis sans toucher aux autres.', 'It will add itself every month, starting from the first month chosen. You can skip a given month without touching the others.')}
      </T>

      {existing ? (
        <ConfirmButton
          label={t('Arrêter et supprimer ce réglage', 'Stop and delete this setup')}
          confirmLabel={t('Confirmer (les mois passés restent)', 'Confirm (past months stay)')}
          onConfirm={() => {
            setBusy(true);
            void remove('recurring', existing.id).then(() => router.back());
          }}
        />
      ) : null}
    </FormScreen>
  );
}
