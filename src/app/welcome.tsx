import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/data/store';
import { cloudConfigured } from '@/data/supabase';
import { useT } from '@/i18n';
import { Button, Notice, TextLink } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { useWide } from '@/ui/layout';
import { Mark } from '@/ui/Logo';
import Svg, { Polygon } from 'react-native-svg';
import { T } from '@/ui/Text';
import { brand, color, isDark, isOutline, radius, space } from '@/ui/theme';

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
  // Once the email is sent: the code it carries can be typed here instead of opening the link.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'negative' | 'positive' } | null>(null);

  async function submit() {
    setBusy(true);
    setNote(null);
    try {
      if (mode === 'link') {
        await backend.sendSignInLink(email.trim());
        setSentTo(email.trim());
        setCode('');
        setNote({ tone: 'positive', text: t(`E-mail envoyé à ${email.trim()}. Saisis le code qu’il contient ci-dessous, ou ouvre le lien sur cet appareil.`, `Email sent to ${email.trim()}. Type the code it contains below, or open the link on this device.`) });
      } else if (mode === 'in') await backend.signIn(email.trim(), password);
      else if (await backend.signUp(email.trim(), password))
        setNote({ tone: 'positive', text: t('Compte créé. Ouvre le lien reçu par e-mail pour le confirmer, puis connecte-toi.', 'Account created. Open the link we emailed you to confirm it, then sign in.') });
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setNote({
        tone: 'negative',
        text: /invalid login/i.test(raw)
          ? t('E-mail ou mot de passe incorrect.', 'Wrong email or password.')
          : /expired|invalid.*(otp|token)|token.*invalid/i.test(raw)
            ? t('Ce code ne fonctionne pas ou a expiré. Vérifie-le, ou demande un nouvel e-mail.', 'This code does not work or has expired. Check it, or ask for a new email.')
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

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setNote(null);
    try {
      await backend.verifySignInCode(sentTo, code.replace(/\s/g, ''));
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setNote({
        tone: 'negative',
        text: /expired|invalid|token/i.test(raw)
          ? t('Ce code ne fonctionne pas ou a expiré. Vérifie-le, ou demande un nouvel e-mail.', 'This code does not work or has expired. Check it, or ask for a new email.')
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: wide ? 'center' : 'flex-start', alignItems: 'center', paddingTop: wide ? insets.top + space.xl : 0, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: wide ? 20 : 0 }}>
        <View style={{ width: '100%', maxWidth: wide ? 920 : undefined, flexDirection: wide ? 'row' : 'column', backgroundColor: color.paper, borderRadius: wide ? radius.xl : 0, borderWidth: wide ? 1 : 0, borderColor: color.line, overflow: 'hidden' }}>
          <BrandPanel wide={wide} top={insets.top} />
          <View style={{ flex: wide ? 1 : undefined, padding: wide ? 44 : 20, paddingTop: wide ? 44 : space.xl, justifyContent: 'center' }}>
            <T variant="title">{t('Bienvenue', 'Welcome')}</T>
            <T color={color.inkSoft} style={{ marginTop: space.xs, marginBottom: space.xl }}>
              {cloudConfigured ? t('Connecte-toi avec ton adresse e-mail.', 'Sign in with your email address.') : t('Découvre l’app avec des données d’exemple.', 'Try the app with sample data.')}
            </T>
          <View style={{ gap: space.lg }}>
            {cloudConfigured ? (
              <>
                <Field label={t('E-mail', 'Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
                {mode === 'link' ? null : <Field label={t('Mot de passe', 'Password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} onSubmitEditing={submit} />}
                {note ? <Notice text={note.text} tone={note.tone} icon={note.tone === 'positive' ? 'check' : 'alert'} /> : null}
                {mode === 'link' && sentTo ? (
                  <>
                    <Field
                      label={t('Code reçu par e-mail', 'Code from the email')}
                      value={code}
                      onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 10))}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      placeholder="123456"
                      onSubmitEditing={verify}
                      style={{ fontSize: 22, letterSpacing: 6 }}
                    />
                    <Button label={t('Me connecter', 'Sign me in')} onPress={verify} busy={busy} disabled={code.length < 6} />
                  </>
                ) : null}
                {mode === 'link' && sentTo ? null : <Button
                  label={mode === 'link' ? t('Recevoir mon lien de connexion', 'Email me a sign-in link') : mode === 'in' ? t('Se connecter', 'Sign in') : t('Créer mon compte', 'Create my account')}
                  onPress={submit}
                  busy={busy}
                  disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || (mode !== 'link' && password.length < 8)}
                />}
                {mode === 'link' && sentTo ? (
                  <View style={{ gap: space.sm }}>
                    <T variant="small" color={color.inkSoft}>
                      {t('Le code arrive en quelques secondes. Pense à regarder les indésirables.', 'The code arrives within seconds. Check your spam folder too.')}
                    </T>
                    <TextLink label={t('Changer d’adresse ou renvoyer l’e-mail', 'Change address or resend the email')} onPress={() => { setSentTo(null); setNote(null); }} />
                  </View>
                ) : mode === 'link' ? (
                  <View style={{ gap: space.sm }}>
                    <T variant="small" color={color.inkSoft}>
                      {t('Pas de mot de passe : tu reçois un e-mail avec un code et un lien. Première fois ? Le compte se crée tout seul.', 'No password: you get an email with a code and a link. First time? The account creates itself.')}
                    </T>
                    <TextLink label={t('Utiliser un mot de passe', 'Use a password instead')} onPress={() => { setNote(null); setSentTo(null); setMode('in'); }} />
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * The brand side of the sign-in page, on the ink of the logo: the mark, what
 * the app is for, and the mark's bars drawn large as a quiet backdrop.
 */
function BrandPanel({ wide, top }: { wide: boolean; top: number }) {
  const t = useT();
  const onInk = 'rgba(255,255,255,0.68)';
  return (
    <View style={{ width: wide ? 400 : undefined, backgroundColor: isOutline() ? '#000000' : isDark() ? '#0F1418' : brand.ink, borderBottomWidth: isOutline() ? 1 : 0, borderRightWidth: isOutline() ? 1 : 0, borderColor: color.line, padding: wide ? 40 : 20, paddingTop: wide ? 40 : top + 28, paddingBottom: wide ? 40 : 28, overflow: 'hidden', minHeight: wide ? 520 : undefined }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Mark size={wide ? 40 : 34} />
        <T variant="heading" color="#FFFFFF" style={{ fontSize: wide ? 22 : 20 }}>
          Stayfolio
        </T>
      </View>
      <T variant="hero" color="#FFFFFF" style={{ marginTop: wide ? 56 : 24, fontSize: wide ? 34 : 26, lineHeight: wide ? 40 : 32, maxWidth: 320 }}>
        {t('Les comptes de mes locations', 'My rental books')}
      </T>
      <T color={onInk} style={{ marginTop: space.md, maxWidth: 300 }}>
        {t('Revenus, dépenses, partages entre associés et reçus, au même endroit.', 'Income, expenses, partner splits and receipts, in one place.')}
      </T>
      {wide ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: -40, bottom: -36, opacity: 0.9 }}>
          <Svg width={300} height={300} viewBox="0 0 120 120">
            {['26,54.6 40,42.8 40,96 26,96', '44,39.5 58,27.7 58,96 44,96', '62,27.7 76,39.5 76,96 62,96', '80,42.8 94,54.6 94,96 80,96'].map((points, i) => (
              <Polygon key={i} points={points} fill={brand.bars[i]} opacity={0.3} />
            ))}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}
