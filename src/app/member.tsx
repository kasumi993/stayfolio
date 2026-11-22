/**
 * Invite someone to a property, or change what they may do. Opened with
 * ?property=… (new) or ?id=… (existing). The link is the only key: no
 * account, no password. Renewing it cuts the old one at once.
 */
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { newId } from '@/core/id';
import { MEMBER_PAGES, type MemberPage } from '@/core/types';
import { MailError } from '@/data/backend';
import { useData, useStore } from '@/data/store';
import { memberUrl, pageLabel } from '@/features/Members';
import { useT } from '@/i18n';
import { Button, Choice, ConfirmButton, Notice, Toggle } from '@/ui/controls';
import { Field, Label } from '@/ui/fields';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export default function MemberScreen() {
  const params = useLocalSearchParams<{ id?: string; property?: string }>();
  const t = useT();
  const data = useData();
  const { saveMember, rotateMember, remove, previewMember } = useStore.getState();
  const [savedId, setSavedId] = useState(params.id ?? null);
  const existing = data.members.find((m) => m.id === savedId);
  const propertyId = existing?.property_id ?? params.property ?? '';
  const property = data.properties.find((p) => p.id === propertyId);

  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [canEdit, setCanEdit] = useState(existing?.can_edit ?? false);
  const [pages, setPages] = useState<MemberPage[]>(existing?.pages ?? ['income', 'expenses', 'invoices', 'report']);
  const [report, setReport] = useState(existing?.monthly_report ?? false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renewed, setRenewed] = useState(false);
  // Result of the last email action, shown under its button.
  const [mail, setMail] = useState<{ kind: 'link' | 'report'; ok: boolean; text: string } | null>(null);
  const [mailing, setMailing] = useState<'link' | 'report' | null>(null);

  const mailError = (e: unknown) => {
    const reason = e instanceof MailError ? e.reason : 'failed';
    return {
      no_email: t('Ajoute d’abord son adresse e-mail et enregistre.', 'Add their email address first and save.'),
      not_configured: t('L’envoi d’e-mails n’est pas encore activé sur le serveur (clé Brevo manquante).', 'Email sending is not set up on the server yet (Brevo key missing).'),
      too_soon: t('Un récap vient de partir : réessaie dans quelques minutes.', 'A recap just went out: try again in a few minutes.'),
      failed: t('L’e-mail n’a pas pu partir. Réessaie plus tard.', 'The email could not be sent. Try again later.'),
    }[reason];
  };
  async function sendMail(kind: 'link' | 'report') {
    if (!existing) return;
    setMailing(kind);
    setMail(null);
    try {
      const { backend } = useStore.getState();
      await (kind === 'link' ? backend.emailMemberLink(existing.id) : backend.sendMemberReport(existing.id));
      setMail({ kind, ok: true, text: kind === 'link' ? t(`Lien envoyé à ${existing.email}.`, `Link sent to ${existing.email}.`) : t(`Récap envoyé à ${existing.email}.`, `Recap sent to ${existing.email}.`) });
    } catch (e) {
      setMail({ kind, ok: false, text: mailError(e) });
    } finally {
      setMailing(null);
    }
  }

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = name.trim().length > 0 && pages.length > 0 && emailOk && (!report || email.trim().length > 0);
  const dirty =
    !existing ||
    existing.name !== name.trim() ||
    existing.email !== email.trim() ||
    existing.can_edit !== canEdit ||
    existing.monthly_report !== report ||
    existing.pages.join() !== pages.join();
  const toggle = (page: MemberPage, on: boolean) => setPages((list) => MEMBER_PAGES.filter((p) => (p === page ? on : list.includes(p))));

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const saved = await saveMember({ id: existing?.id ?? newId(), property_id: propertyId, name: name.trim(), email: email.trim(), can_edit: canEdit, pages, monthly_report: report });
      setSavedId(saved.id);
    } catch (e) {
      useStore.setState({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!property) {
    return (
      <FormScreen title={t('Membre', 'Member')}>
        <T color={color.inkSoft}>{t('Ce bien n’existe plus.', 'This property no longer exists.')}</T>
      </FormScreen>
    );
  }

  const link = existing ? memberUrl(existing.token) : null;

  return (
    <FormScreen
      title={existing ? existing.name : t(`Inviter sur ${property.name}`, `Invite to ${property.name}`)}
      footer={dirty ? <Button label={existing ? t('Enregistrer', 'Save') : t('Créer le lien', 'Create the link')} onPress={() => void submit()} busy={busy} disabled={!valid} /> : undefined}>
      {link ? (
        <View style={{ gap: space.md }}>
          <Label>{t('Son lien personnel', 'Their personal link')}</Label>
          <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg, backgroundColor: color.surface }}>
            <T variant="label" selectable numberOfLines={2}>
              {link}
            </T>
          </View>
          {renewed ? <Notice tone="positive" icon="check" text={t('Nouveau lien prêt. L’ancien ne fonctionne plus : envoie celui-ci.', 'New link ready. The old one no longer works: send this one.')} /> : null}
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Button compact icon="share" label={t('Envoyer', 'Send')} onPress={() => void Share.share({ message: t(`${property.name} sur Stayfolio : ${link}`, `${property.name} on Stayfolio: ${link}`) }).catch(() => {})} />
            <Button
              compact
              tone="quiet"
              icon="link"
              label={copied ? t('Lien copié', 'Link copied') : t('Copier', 'Copy')}
              onPress={() => {
                void Clipboard.setStringAsync(link);
                setCopied(true);
              }}
            />
            {existing?.email ? (
              <Button compact tone="quiet" icon="mail" label={t('Envoyer par e-mail', 'Email it')} busy={mailing === 'link'} onPress={() => void sendMail('link')} />
            ) : null}
            <Button
              compact
              tone="quiet"
              icon="eye"
              label={t('Voir comme cette personne', 'See as this person')}
              onPress={() => {
                router.dismissAll();
                void previewMember(existing!);
                router.replace('/');
              }}
            />
          </View>
          {mail?.kind === 'link' ? <Notice tone={mail.ok ? 'positive' : 'negative'} icon={mail.ok ? 'check' : 'alert'} text={mail.text} /> : null}
          <T variant="small" color={color.inkSoft}>
            {t(
              'Pas de compte ni de mot de passe : quiconque a ce lien entre avec ces droits. Envoie-le directement à la personne.',
              'No account or password: anyone holding this link gets in with these rights. Send it straight to the person.',
            )}
          </T>
        </View>
      ) : (
        <Notice icon="link" text={t('Après l’enregistrement, tu obtiens un lien personnel à lui envoyer. Pas de compte ni de mot de passe pour elle ou lui.', 'Once saved, you get a personal link to send them. No account or password needed.')} />
      )}

      <Field label={t('Nom', 'Name')} value={name} onChangeText={setName} placeholder={t('Awa, le comptable…', 'Awa, the accountant…')} maxLength={80} />

      <View>
        <Label>{t('Accès', 'Access')}</Label>
        <Choice
          value={canEdit ? 'edit' : 'view'}
          onChange={(v) => setCanEdit(v === 'edit')}
          options={[
            { value: 'view', label: t('Voir seulement', 'View only') },
            { value: 'edit', label: t('Voir et modifier', 'View and edit') },
          ]}
        />
        <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
          {canEdit
            ? t('Peut ajouter, corriger et supprimer des revenus et des dépenses, et ranger des factures. Jamais tes dépenses privées, tes règles ni tes autres biens.', 'Can add, correct and delete income and expenses, and file invoices. Never your private expenses, your rules or your other places.')
            : t('Consulte sans rien pouvoir changer.', 'Looks without being able to change anything.')}
        </T>
      </View>

      <View style={{ gap: space.md }}>
        <Label>{t('Pages visibles', 'Visible pages')}</Label>
        {MEMBER_PAGES.map((page) => (
          <Toggle key={page} label={pageLabel(page, t)} hint={pageHint(page, t)} value={pages.includes(page)} onChange={(on) => toggle(page, on)} />
        ))}
        {!pages.length ? <Notice tone="negative" text={t('Choisis au moins une page.', 'Pick at least one page.')} /> : null}
      </View>

      <View style={{ gap: space.md }}>
        <Label>{t('Rapport mensuel', 'Monthly report')}</Label>
        <Toggle label={t('Recevoir le récap chaque mois par e-mail', 'Get the recap every month by email')} value={report} onChange={setReport} />
        {report || email ? (
          <Field label={t('E-mail', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="awa@exemple.com" />
        ) : null}
        {!emailOk ? <Notice tone="negative" text={t('Cette adresse e-mail ne semble pas complète.', 'This email address does not look complete.')} /> : null}
        {report ? (
          <T variant="small" color={color.inkSoft}>
            {t('Le 1er de chaque mois, le récap du mois écoulé part à cette adresse, avec seulement les pages que la personne voit.', 'On the 1st of each month, the recap of the past month goes to this address, with only the pages they can see.')}
          </T>
        ) : null}
        {existing?.monthly_report && existing.email && !dirty ? (
          <Button compact tone="quiet" icon="mail" label={t('Envoyer le récap du mois dernier maintenant', 'Send last month’s recap now')} busy={mailing === 'report'} onPress={() => void sendMail('report')} />
        ) : null}
        {mail?.kind === 'report' ? <Notice tone={mail.ok ? 'positive' : 'negative'} icon={mail.ok ? 'check' : 'alert'} text={mail.text} /> : null}
      </View>

      {existing ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Button
            tone="quiet"
            icon="repeat"
            label={t('Créer un nouveau lien', 'Make a new link')}
            onPress={() =>
              void rotateMember(existing.id)
                .then(() => {
                  setRenewed(true);
                  setCopied(false);
                })
                .catch((e: unknown) => useStore.setState({ error: e instanceof Error ? e.message : String(e) }))
            }
          />
          <T variant="small" color={color.inkSoft}>
            {t('Utile si le lien a circulé : l’ancien cesse de fonctionner immédiatement.', 'Useful if the link got passed around: the old one stops working right away.')}
          </T>
          <ConfirmButton
            label={t('Retirer l’accès', 'Remove access')}
            confirmLabel={t(`Confirmer : ${existing.name} n’aura plus accès`, `Confirm: ${existing.name} loses access`)}
            onConfirm={() =>
              void remove('members', existing.id)
                .then(() => router.back())
                .catch(() => {})
            }
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

function pageHint(page: MemberPage, t: (fr: string, en: string) => string): string {
  return {
    income: t('Les versements reçus', 'Payouts received'),
    expenses: t('Les dépenses du logement, jamais les privées', 'The place’s expenses, never private ones'),
    invoices: t('Les factures et reçus rangés', 'Filed invoices and receipts'),
    report: t('Résultat du mois, graphiques, bilan de l’année et répartition', 'Monthly result, charts, yearly report and split'),
    cash: t('Ce que chacun a apporté, ce qui a été versé, la caisse', 'What each put in, what was paid out, cash on hand'),
  }[page];
}
