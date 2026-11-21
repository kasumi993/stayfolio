/** Account settings, export, and the way out (sign out, delete account). */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { today } from '@/core/dates';
import { exportWorkbook } from '@/core/export';
import { evalAmount } from '@/core/money';
import { useData, useStore } from '@/data/store';
import { useT } from '@/i18n';
import { saveFile } from '@/platform/saveFile';
import { Button, Choice, ConfirmButton, Notice } from '@/ui/controls';
import { Field, Label } from '@/ui/fields';
import { InstallSetting } from '@/features/InstallBanner';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color } from '@/ui/theme';

export default function SettingsScreen() {
  const t = useT();
  const data = useData();
  const session = useStore((s) => s.session);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const backend = useStore((s) => s.backend);
  const { saveProfile, signOut } = useStore.getState();
  const profile = data.profile;
  const [name, setName] = useState(profile.name);
  const [eur, setEur] = useState(String(profile.fx.EUR ?? ''));
  const [usd, setUsd] = useState(String(profile.fx.USD ?? ''));
  const [busy, setBusy] = useState(false);

  const save = (patch: Partial<typeof profile>) => void saveProfile({ ...profile, ...patch }).catch(() => {});
  const saveRates = () => {
    const fx = { ...profile.fx };
    const e = evalAmount(eur);
    const u = evalAmount(usd);
    if (e && e > 0) fx.EUR = e;
    if (u && u > 0) fx.USD = u;
    save({ fx });
  };

  async function exportAll() {
    setBusy(true);
    try {
      await saveFile(`stayfolio-${today()}.xlsx`, exportWorkbook(data), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen title={t('Réglages', 'Settings')}>
      {backend.demo ? <Notice text={t('Mode démo : données d’exemple, rien n’est enregistré.', 'Demo mode: sample data, nothing is saved.')} /> : null}
      <Field label={t('Mon prénom (affiché sur les relevés partagés)', 'My name (shown on shared statements)')} value={name} onChangeText={setName} onBlur={() => name.trim() !== profile.name && save({ name: name.trim() })} />
      <View>
        <Label>{t('Langue', 'Language')}</Label>
        <Choice value={profile.locale} onChange={(locale) => save({ locale })} options={[{ value: 'fr' as const, label: 'Français' }, { value: 'en' as const, label: 'English' }]} />
      </View>

      <View>
        <Label>{t('Couleurs', 'Colours')}</Label>
        <Choice
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'pastel' as const, label: 'Pastel', dot: '#8ED0AC' },
            { value: 'indigo' as const, label: 'Indigo', dot: '#2B2580' },
          ]}
        />
      </View>

      <InstallSetting />

      <View>
        <T variant="heading">{t('Devises', 'Currencies')}</T>
        <T variant="small" color={color.inkSoft}>
          {t(`Tous les totaux sont en ${profile.currency}. Ces taux servent par défaut ; chaque écriture peut avoir le sien.`, `Every total is in ${profile.currency}. These rates are defaults; each entry can carry its own.`)}
        </T>
      </View>
      <Field label={`1 EUR = … ${profile.currency}`} value={eur} onChangeText={setEur} onBlur={saveRates} keyboardType="numbers-and-punctuation" />
      <Field label={`1 USD = … ${profile.currency}`} value={usd} onChangeText={setUsd} onBlur={saveRates} keyboardType="numbers-and-punctuation" />

      <View>
        <T variant="heading">{t('Mes données', 'My data')}</T>
        <T variant="small" color={color.inkSoft}>
          {t('Un classeur Excel avec tout : revenus, dépenses, règles, versements et tableau de bord mensuel.', 'An Excel workbook with everything: income, expenses, rules, payments and the monthly dashboard.')}
        </T>
      </View>
      <Button tone="dark" icon="download" label={t('Exporter vers Excel', 'Export to Excel')} onPress={() => void exportAll()} busy={busy} />
      <Button tone="quiet" icon="download" label={t('Importer un classeur Excel', 'Import an Excel workbook')} onPress={() => router.push('/import')} />

      <View>
        <T variant="heading">{t('Compte', 'Account')}</T>
        <T variant="small" color={color.inkSoft}>
          {backend.demo ? t('Démo', 'Demo') : session?.email}
        </T>
      </View>
      <Button tone="quiet" label={backend.demo ? t('Quitter la démo', 'Leave the demo') : t('Se déconnecter', 'Sign out')} onPress={() => void signOut()} />
      {!backend.demo ? (
        <ConfirmButton
          label={t('Supprimer mon compte et toutes mes données', 'Delete my account and all my data')}
          confirmLabel={t('Oui, tout supprimer définitivement', 'Yes, delete everything for good')}
          onConfirm={() => void backend.deleteAccount().then(() => signOut()).catch((e) => useStore.setState({ error: String(e?.message ?? e) }))}
        />
      ) : null}
    </FormScreen>
  );
}
