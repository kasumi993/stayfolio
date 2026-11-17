import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { cloudConfigured } from '@/data/supabase';
import { useT } from '@/i18n';
import { Button, Notice, TextLink } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { useWide } from '@/ui/layout';
import { Logo } from '@/ui/Logo';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export default function Welcome() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const backend = useStore((s) => s.backend);
  const enterDemo = useStore((s) => s.enterDemo);
  // 'link': a sign-in link by email, no password. 'in' / 'up': with a password.
  const [mode, setMode] = useState<'link' | 'in' | 'up'>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'negative' | 'positive' } | null>(null);

  async function submit() {
    setBusy(true);
    setNote(null);
    try {
      if (mode === 'link') {
        await backend.sendSignInLink(email.trim());
        setNote({ tone: 'positive', text: t(`Lien envoyé à ${email.trim()}. Ouvre-le sur cet appareil : il te connecte directement.`, `Link sent to ${email.trim()}. Open it on this device: it signs you in directly.`) });
      } else if (mode === 'in') await backend.signIn(email.trim(), password);
      else if (await backend.signUp(email.trim(), password))
        setNote({ tone: 'positive', text: t('Compte créé. Ouvre le lien reçu par e-mail pour le confirmer, puis connecte-toi.', 'Account created. Open the link we emailed you to confirm it, then sign in.') });
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setNote({
        tone: 'negative',
        text: /invalid login/i.test(raw)
          ? t('E-mail ou mot de passe incorrect.', 'Wrong email or password.')
          : /not authorized/i.test(raw)
            ? t('L’envoi d’e-mails n’est pas encore ouvert à cette adresse. Demande à la personne qui t’a invité·e.', 'Email delivery is not open to this address yet. Ask the person who invited you.')
            : /rate limit|only request this/i.test(raw)
              ? t('Trop de demandes pour l’instant. Réessaie dans quelques minutes, ou connecte-toi avec ton mot de passe.', 'Too many requests for now. Try again in a few minutes, or sign in with your password.')
              : /not confirmed/i.test(raw)
            ? t('Confirme d’abord ton adresse avec le lien reçu par e-mail.', 'Confirm your address first with the link we emailed you.')
            : raw || t('Connexion impossible.', 'Could not sign in.'),
      });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return setNote({ tone: 'negative', text: t('Saisis ton e-mail d’abord.', 'Enter your email first.') });
    await backend.sendPasswordReset(email.trim()).catch(() => {});
    setNote({ tone: 'positive', text: t('Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.', 'If an account exists for this address, a reset link is on its way.') });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: wide ? color.sunken : color.paper }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: wide ? 'center' : 'flex-start', alignItems: 'center', paddingTop: insets.top + (wide ? space.xl : 56), paddingBottom: insets.bottom + space.xxl, paddingHorizontal: 20 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: color.paper, borderRadius: radius.xl, padding: wide ? 36 : 0, borderWidth: wide ? 1 : 0, borderColor: color.line }}>
          <Logo size={30} />
          <T variant="title" style={{ marginTop: space.xl }}>
            {t('Les comptes de mes locations', 'My rental books')}
          </T>
          <T color={color.inkSoft} style={{ marginTop: space.xs }}>
            {t('Revenus, dépenses, partages et reçus, au même endroit.', 'Income, expenses, splits and receipts, in one place.')}
          </T>
          <View style={{ gap: space.lg, marginTop: space.xl }}>
            {cloudConfigured ? (
              <>
                <Field label={t('E-mail', 'Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
                {mode === 'link' ? null : <Field label={t('Mot de passe', 'Password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} onSubmitEditing={submit} />}
                {note ? <Notice text={note.text} tone={note.tone} icon={note.tone === 'positive' ? 'check' : 'alert'} /> : null}
                <Button
                  label={mode === 'link' ? t('Recevoir mon lien de connexion', 'Email me a sign-in link') : mode === 'in' ? t('Se connecter', 'Sign in') : t('Créer mon compte', 'Create my account')}
                  onPress={submit}
                  busy={busy}
                  disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || (mode !== 'link' && password.length < 8)}
                />
                {mode === 'link' ? (
                  <View style={{ gap: space.sm }}>
                    <T variant="small" color={color.inkSoft}>
                      {t('Pas de mot de passe : tu reçois un lien par e-mail, il suffit de l’ouvrir. Première fois ? Le compte se crée tout seul.', 'No password: you get a link by email and just open it. First time? The account creates itself.')}
                    </T>
                    <TextLink label={t('Utiliser un mot de passe', 'Use a password instead')} onPress={() => { setNote(null); setMode('in'); }} />
                  </View>
                ) : (
                  <View style={{ gap: space.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <TextLink label={mode === 'in' ? t('Créer un compte', 'Create an account') : t('J’ai déjà un compte', 'I already have an account')} onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
                      {mode === 'in' ? <TextLink label={t('Mot de passe oublié', 'Forgot password')} onPress={forgot} /> : null}
                    </View>
                    <TextLink label={t('Recevoir un lien par e-mail à la place', 'Get a link by email instead')} onPress={() => { setNote(null); setMode('link'); }} />
                  </View>
                )}
                {mode === 'up' ? (
                  <T variant="small" color={color.inkSoft}>
                    {t('8 caractères minimum.', 'At least 8 characters.')}
                  </T>
                ) : null}
              </>
            ) : (
              <Notice text={t('Cette version n’est reliée à aucun compte en ligne. La démo fonctionne entièrement sur l’appareil.', 'This build is not connected to an online account. The demo runs entirely on the device.')} />
            )}
            <Button tone="quiet" label={t('Explorer la démo', 'Explore the demo')} onPress={() => void enterDemo()} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
