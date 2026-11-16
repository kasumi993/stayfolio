/**
 * The calculation rules of a property: my commission, and each party's share
 * of income and of expenses. A change can apply from a chosen month onwards,
 * leaving earlier months as they were, or to the whole history.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ruleFor } from '@/core/calc';
import { newId } from '@/core/id';
import { evalAmount } from '@/core/money';
import type { Party, Rule } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { usePartiesOf } from '@/features/hooks';
import { monthLabel, useLocale, useT } from '@/i18n';
import { Button, Choice, Notice, TextLink } from '@/ui/controls';
import { Field, Label } from '@/ui/fields';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

const pct = (fraction: number) => String(Math.round(fraction * 10000) / 100);
const frac = (text: string) => Math.min(Math.max((evalAmount(text) ?? 0) / 100, 0), 1);

export default function RulesScreen() {
  const { property: propertyId } = useLocalSearchParams<{ property: string }>();
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const month = useStore((s) => s.month);
  const { save, remove } = useStore.getState();
  const stored = usePartiesOf(propertyId);
  const current = ruleFor(data.rules, propertyId, month);

  const [parties, setParties] = useState<Party[]>(stored);
  const [commission, setCommission] = useState(pct(current?.commission_rate ?? 0));
  const [shares, setShares] = useState<Record<string, { revenue: string; expense: string }>>(() =>
    Object.fromEntries(stored.map((p) => {
      const s = current?.shares.find((x) => x.party_id === p.id);
      return [p.id, { revenue: pct(s?.revenue ?? (stored.length === 1 ? 1 : 0)), expense: pct(s?.expense ?? (stored.length === 1 ? 1 : 0)) }];
    })),
  );
  const [scope, setScope] = useState<'from' | 'all'>(current && current.effective_from < month ? 'from' : 'all');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const total = (key: 'revenue' | 'expense') => parties.reduce((sum, p) => sum + frac(shares[p.id]?.[key] ?? '0'), 0);
  const balanced = Math.abs(total('revenue') - 1) < 0.0001 && Math.abs(total('expense') - 1) < 0.0001;
  const setShare = (id: string, key: 'revenue' | 'expense', value: string) => setShares({ ...shares, [id]: { ...shares[id], [key]: value } });

  function addParty() {
    const party: Party = { id: newId(), property_id: propertyId, name: newName.trim(), is_me: false };
    setParties([...parties, party]);
    setShares({ ...shares, [party.id]: { revenue: '0', expense: '0' } });
    setNewName('');
  }

  async function submit() {
    setBusy(true);
    const own = data.rules.filter((r) => r.property_id === propertyId).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    const rule: Rule = {
      id: newId(),
      property_id: propertyId,
      effective_from: month,
      commission_rate: frac(commission),
      shares: parties.map((p) => ({ party_id: p.id, revenue: frac(shares[p.id].revenue), expense: frac(shares[p.id].expense) })),
    };
    try {
      await save('parties', parties);
      if (scope === 'all' || !own.length) {
        // One rule for the whole history.
        if (own.length > 1) await remove('rules', own.slice(1).map((r) => r.id));
        await save('rules', { ...rule, id: own[0]?.id ?? rule.id, effective_from: own[0]?.effective_from ?? month });
      } else {
        // Keep the past as it was; the new rule starts this month.
        const sameMonth = own.find((r) => r.effective_from === month);
        const later = own.filter((r) => r.effective_from > month);
        if (later.length) await remove('rules', later.map((r) => r.id));
        await save('rules', { ...rule, id: sameMonth?.id ?? rule.id });
      }
      const gone = stored.filter((p) => !parties.some((x) => x.id === p.id));
      if (gone.length) await remove('parties', gone.map((p) => p.id));
      router.back();
    } catch {
      setBusy(false);
    }
  }

  return (
    <FormScreen title={t('Règles de calcul', 'Calculation rules')} footer={<Button label={t('Enregistrer', 'Save')} onPress={submit} busy={busy} disabled={!balanced} />}>
      <Field label={t('Ma commission sur chaque réservation (%)', 'My commission on each booking (%)')} value={commission} onChangeText={setCommission} keyboardType="numbers-and-punctuation" />
      <T variant="small" color={color.inkSoft} style={{ marginTop: -space.sm }}>
        {t('Prélevée sur le versement net, avant le partage des revenus. Une réservation peut avoir son propre taux.', 'Taken from the net payout, before income is shared. A single booking can carry its own rate.')}
      </T>

      {parties.map((p) => (
        <View key={p.id} style={{ backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="heading">{p.is_me ? t('Moi', 'Me') : p.name}</T>
            {!p.is_me ? <TextLink label={t('Retirer', 'Remove')} tint={color.negative} onPress={() => setParties(parties.filter((x) => x.id !== p.id))} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label={t('Part des revenus (%)', 'Share of income (%)')} value={shares[p.id]?.revenue ?? '0'} onChangeText={(v) => setShare(p.id, 'revenue', v)} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Part des dépenses (%)', 'Share of expenses (%)')} value={shares[p.id]?.expense ?? '0'} onChangeText={(v) => setShare(p.id, 'expense', v)} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
        </View>
      ))}

      {!balanced ? (
        <Notice
          tone="negative"
          text={t(`Les parts doivent faire 100 %. Revenus : ${pct(total('revenue'))} %, dépenses : ${pct(total('expense'))} %.`, `Shares must add up to 100%. Income: ${pct(total('revenue'))}%, expenses: ${pct(total('expense'))}%.`)}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label={t('Ajouter un associé ou un propriétaire', 'Add a partner or an owner')} value={newName} onChangeText={setNewName} placeholder={t('Son nom', 'Their name')} />
        </View>
        <Button compact tone="quiet" label={t('Ajouter', 'Add')} onPress={addParty} disabled={!newName.trim()} style={{ height: 50 }} />
      </View>

      {current ? (
        <View>
          <Label>{t('Appliquer ces règles', 'Apply these rules')}</Label>
          <Choice
            value={scope}
            onChange={setScope}
            options={[
              { value: 'from', label: t(`À partir de ${monthLabel(month, locale).toLowerCase()}`, `From ${monthLabel(month, locale)}`) },
              { value: 'all', label: t('À tout l’historique', 'To the whole history') },
            ]}
          />
          <T variant="small" color={color.inkSoft} style={{ marginTop: 6 }}>
            {scope === 'from'
              ? t('Les mois précédents gardent leurs règles et leurs résultats.', 'Earlier months keep their rules and their results.')
              : t('Tous les mois sont recalculés avec ces règles.', 'Every month is recalculated with these rules.')}
          </T>
        </View>
      ) : null}
      {stored.some((p) => !parties.some((x) => x.id === p.id)) ? <Notice text={t('Retirer une personne efface aussi les versements notés avec elle.', 'Removing someone also erases the payments recorded with them.')} /> : null}
    </FormScreen>
  );
}
