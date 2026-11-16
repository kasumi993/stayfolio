/** Choose a new password after opening the link from the reset email. */
import { router } from 'expo-router';
import { useState } from 'react';

import { useStore } from '@/data/store';
import { useT } from '@/i18n';
import { Button, Notice } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { FormScreen } from '@/ui/layout';

export default function ResetScreen() {
  const t = useT();
  const backend = useStore((s) => s.backend);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      await backend.updatePassword(password);
      router.replace('/');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <FormScreen title={t('Nouveau mot de passe', 'New password')} footer={<Button label={t('Enregistrer le mot de passe', 'Save the password')} onPress={submit} busy={busy} disabled={password.length < 8} />}>
      <Field label={t('Nouveau mot de passe (8 caractères minimum)', 'New password (at least 8 characters)')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      {failed ? <Notice tone="negative" text={t('Le lien a expiré. Redemande un e-mail de réinitialisation depuis l’écran de connexion.', 'The link has expired. Ask for a new reset email from the sign-in screen.')} /> : null}
    </FormScreen>
  );
}
