/**
 * Import the Excel tracker. The file is read on the device, checked against
 * the workbook's own monthly dashboard, and only saved once confirmed.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { monthStatement, statement } from '@/core/calc';
import { type ImportPlan, planImport, withSetup } from '@/core/importWorkbook';
import { type Data, emptyData } from '@/core/types';
import { useStore } from '@/data/store';
import { useMoney } from '@/features/hooks';
import { de, monthLabel, shareLabel, useLocale, useT } from '@/i18n';
import { pickWorkbook } from '@/platform/pick';
import { Button, Notice, Row, SectionTitle, Toggle } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { Block, FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color } from '@/ui/theme';

export default function ImportScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const applyImport = useStore((s) => s.applyImport);
  const [raw, setPlan] = useState<ImportPlan | null>(null);
  // Set-up costs stay out of the profit the partners share: on by default when there is a partner.
  const [asSetup, setAsSetup] = useState(true);
  const plan = useMemo(() => (raw && asSetup ? withSetup(raw) : raw), [raw, asSetup]);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The plan as if it were already imported, to run the real calculations on it. */
  const preview = useMemo((): Data | null => {
    if (!plan) return null;
    return { ...emptyData(), properties: [plan.property], parties: plan.parties, rules: [plan.rule], bookings: plan.bookings, expenses: plan.expenses, transfers: plan.transfers };
  }, [plan]);

  const check = useMemo(() => {
    if (!plan || !preview) return null;
    const matching = plan.dashboard.filter((row) => {
      const s = monthStatement(preview, plan.property.id, row.month);
      return Math.abs(s.revenue - row.revenue) < 1 && Math.abs(s.expenses + s.setup - row.expenses) < 1;
    });
    return { total: plan.dashboard.length, matching: matching.length, all: statement(preview, plan.property.id, () => true) };
  }, [plan, preview]);

  async function choose() {
    setProblem(null);
    try {
      const file = await pickWorkbook();
      if (!file) return;
      const next = planImport(file.bytes, file.name);
      setPlan(next);
      setAsSetup(next.parties.length > 1);
      setName(next.property.name);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setProblem(
        code === 'empty_workbook'
          ? t('Ce classeur ne contient aucune ligne de revenu ou de dépense.', 'This workbook has no income or expense rows.')
          : t('Ce fichier n’a pas la forme attendue : il faut les feuilles « Revenue_Entries » et « Expense_Entries », comme dans le classeur Airbnb Tracker.', 'This file does not have the expected shape: it needs the “Revenue_Entries” and “Expense_Entries” sheets, as in the Airbnb Tracker workbook.'),
      );
    }
  }

  async function confirm() {
    if (!plan) return;
    setBusy(true);
    try {
      await applyImport({ ...plan, property: { ...plan.property, name: name.trim() || plan.property.name } });
      router.dismissTo('/');
    } catch {
      setBusy(false);
    }
  }

  if (!plan || !check) {
    return (
      <FormScreen title={t('Importer un classeur Excel', 'Import an Excel workbook')}>
        <T color={color.inkSoft}>
          {t('Choisis ton fichier .xlsx. Un classeur devient un bien, avec ses revenus, ses dépenses, ses règles de partage et les versements déjà notés. Rien n’est enregistré avant ta confirmation.', 'Choose your .xlsx file. One workbook becomes one property, with its income, expenses, sharing rules and the payments already noted. Nothing is saved before you confirm.')}
        </T>
        {problem ? <Notice tone="negative" text={problem} /> : null}
        <Button icon="download" label={t('Choisir le fichier', 'Choose the file')} onPress={() => void choose()} />
      </FormScreen>
    );
  }

  const partner = plan.parties.find((p) => !p.is_me);
  const first = plan.rule.effective_from;
  const running = plan.expenses.filter((x) => x.scope !== 'setup').length;
  return (
    <FormScreen title={t('Vérifier avant d’importer', 'Check before importing')} footer={<Button label={t('Importer ce bien', 'Import this property')} onPress={() => void confirm()} busy={busy} />}>
      <Field label={t('Nom du bien', 'Property name')} value={name} onChangeText={setName} />

      {check.total ? (
        check.matching === check.total ? (
          <Notice tone="positive" icon="check" text={t(`Les ${check.total} mois recalculés sont identiques au tableau de bord de ton Excel, au franc près.`, `All ${check.total} recalculated months match your Excel dashboard exactly.`)} />
        ) : (
          <Notice text={t(`${check.matching} mois sur ${check.total} sont identiques au tableau de bord de ton Excel. Les autres diffèrent : vérifie-les après l’import.`, `${check.matching} of ${check.total} months match your Excel dashboard. The others differ: check them after importing.`)} />
        )
      ) : null}
      {plan.warnings.map((w) => (
        <Notice key={w} text={w} />
      ))}

      {raw?.setupIds.length ? (
        <Toggle
          value={asSetup}
          onChange={setAsSetup}
          label={t(`Compter les achats ${de(monthLabel(first, locale).toLowerCase())} comme mise en place`, `Count the ${monthLabel(first, locale)} purchases as set-up costs`)}
          hint={t(`${raw.setupIds.length} dépenses du premier mois, loyer mis à part. Payées par les apports, elles sortent du résultat des mois et du bénéfice à partager. Chacune se change ensuite.`, `${raw.setupIds.length} expenses of the first month, rent aside. Paid out of the contributions, they stay out of the monthly results and of the profit to share. Each can be changed later.`)}
        />
      ) : null}

      <View>
        <SectionTitle>{t('Ce qui sera importé', 'What will be imported')}</SectionTitle>
        <Block>
          <Row title={t('Revenus', 'Income')} subtitle={t(`${plan.bookings.length} versements, ${check.all.nights} nuits`, `${plan.bookings.length} payouts, ${check.all.nights} nights`)} value={money(check.all.revenue)} />
          <Row title={t('Dépenses', 'Expenses')} subtitle={t(`${running} lignes`, `${running} rows`)} value={money(-check.all.expenses)} />
          {check.all.setup ? <Row title={t('Mise en place', 'Set-up costs')} subtitle={t(`${plan.expenses.length - running} lignes, hors résultat des mois`, `${plan.expenses.length - running} rows, outside the monthly results`)} value={money(-check.all.setup)} /> : null}
          <Row title={t('Résultat cumulé', 'Cumulative result')} subtitle={check.all.setup ? t('Mise en place comprise', 'Set-up costs included') : undefined} value={money(check.all.net - check.all.setup, { sign: true })} valueColor={check.all.net - check.all.setup < 0 ? color.negative : color.positive} />
          {plan.transfers.length ? <Row title={t(`Versements ${de(partner?.name ?? '')}`, `Payments from ${partner?.name ?? ''}`)} subtitle={t(`${plan.transfers.length} versements`, `${plan.transfers.length} payments`)} value={money(plan.transfers.reduce((s, x) => s + x.amount, 0))} /> : null}
          {plan.rule.shares.map((s, i, list) => {
            const party = plan.parties.find((p) => p.id === s.party_id);
            return <Row key={s.party_id} title={party?.name ?? ''} subtitle={shareLabel(s, locale)} last={i === list.length - 1 && !plan.recurring.length} />;
          })}
          {plan.recurring.map((r, i) => (
            <Row key={r.id} title={t('Loyer en dépense récurrente', 'Rent as a recurring expense')} subtitle={t(`Ajouté seul chaque mois à partir de ${monthLabel(r.start_month, locale).toLowerCase()}`, `Added by itself every month from ${monthLabel(r.start_month, locale)}`)} value={money(r.amount * r.fx_rate)} last={i === plan.recurring.length - 1} />
          ))}
        </Block>
      </View>
      <T variant="small" color={color.inkSoft}>
        {t('Les règles de partage viennent de la feuille Setup. Elles restent modifiables après l’import, depuis la fiche du bien.', 'The sharing rules come from the Setup sheet. They stay editable after the import, from the property page.')}
      </T>
    </FormScreen>
  );
}
