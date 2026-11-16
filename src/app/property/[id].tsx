/**
 * One property: who owes whom, its rules, its recurring expenses and the
 * statements shared with its owner or partner.
 */
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { balances, base, ruleFor } from '@/core/calc';
import { currentMonth } from '@/core/dates';
import { formatMoney, formatPercent } from '@/core/money';
import { useData, useStore } from '@/data/store';
import { useMoney, usePartiesOf } from '@/features/hooks';
import { shareUrl } from '@/features/links';
import { categoryLabel, dayLabel, kindLabel, monthLabel, useLocale, useT } from '@/i18n';
import { Button, IconButton, Row, SectionTitle, TextLink } from '@/ui/controls';
import { Block, Column, FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentOf, radius, space } from '@/ui/theme';

export default function PropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const insets = useSafeAreaInsets();
  const data = useData();
  const property = data.properties.find((p) => p.id === id);
  const parties = usePartiesOf(id);
  const [copied, setCopied] = useState<string | null>(null);

  const bal = useMemo(() => balances(data, id), [data, id]);
  if (!property) return <FormScreen title="" back>{null}</FormScreen>;

  const rule = ruleFor(data.rules, id, currentMonth());
  const rules = data.rules.filter((r) => r.property_id === id);
  const recurring = data.recurring.filter((r) => r.property_id === id);
  const transfers = data.transfers.filter((x) => x.property_id === id).sort((a, b) => b.date.localeCompare(a.date));
  const shares = data.shares.filter((s) => s.property_id === id && !s.revoked).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const others = bal.filter((b) => !b.party.is_me);
  const nameOf = (pid: string) => {
    const p = parties.find((x) => x.id === pid);
    return p?.is_me ? t('Moi', 'Me') : (p?.name ?? '');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <View style={{ backgroundColor: pigmentOf(property.color), paddingTop: insets.top + space.sm, paddingBottom: space.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
        <Column>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginLeft: -8 }}>
            <IconButton icon="left" label={t('Retour', 'Back')} tint={color.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/properties'))} />
            <IconButton icon="edit" label={t('Réglages du bien', 'Property settings')} tint={color.white} onPress={() => router.push({ pathname: '/property/new', params: { id } })} />
          </View>
          <T variant="title" color={color.white} style={{ marginTop: space.sm }}>
            {property.name}
          </T>
          <T color={color.onDark}>{[kindLabel(property.kind, locale), property.location].filter(Boolean).join(', ')}</T>
        </Column>
      </View>

      <FormScreenBody>
        {others.length ? (
          <>
            <SectionTitle action={<TextLink label={t('Noter un versement', 'Record a payment')} onPress={() => router.push({ pathname: '/transfer', params: { property: id } })} />}>
              {t('Où on en est', 'Where things stand')}
            </SectionTitle>
            {others.map((b) => (
              <View key={b.party.id} style={{ marginBottom: space.sm }}>
              <Block>
                <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line }}>
                  <T variant="heading">
                    {Math.abs(b.balance) < 1
                      ? t(`Rien à régler avec ${b.party.name}.`, `All settled with ${b.party.name}.`)
                      : b.balance > 0
                        ? t(`Je dois ${money(b.balance)} à ${b.party.name}.`, `I owe ${b.party.name} ${money(b.balance)}.`)
                        : t(`${b.party.name} me doit ${money(-b.balance)}.`, `${b.party.name} owes me ${money(-b.balance)}.`)}
                  </T>
                  <T variant="small" color={color.inkSoft}>
                    {t('Depuis le début, tous mois confondus.', 'Since the beginning, all months together.')}
                  </T>
                </View>
                <Row title={t('Sa part du résultat', 'Their share of the result')} value={money(b.entitled, { sign: true })} />
                {b.received ? <Row title={t('Revenus encaissés directement', 'Income collected directly')} value={money(-b.received)} /> : null}
                {b.paid ? <Row title={t('Dépenses payées de sa poche', 'Expenses paid out of pocket')} value={money(b.paid, { sign: true })} /> : null}
                {b.transfersOut ? <Row title={t(`Déjà versé par ${b.party.name}`, `Already paid in by ${b.party.name}`)} value={money(b.transfersOut, { sign: true })} /> : null}
                {b.transfersIn ? <Row title={t('Déjà reçu de moi', 'Already received from me')} value={money(-b.transfersIn)} /> : null}
              </Block>
              </View>
            ))}
            {transfers.length ? (
              <View style={{ marginTop: space.md }}>
              <T variant="label" color={color.inkSoft} style={{ marginBottom: space.sm }}>
                {t('Derniers versements', 'Latest payments')}
              </T>
              <Block>
                {transfers.slice(0, 6).map((x, i, list) => (
                  <Row
                    key={x.id}
                    title={`${nameOf(x.from_party)} → ${nameOf(x.to_party)}`}
                    subtitle={[dayLabel(x.date, locale) + ' ' + x.date.slice(0, 4), x.note].filter(Boolean).join(', ')}
                    value={money(x.amount)}
                    onPress={() => router.push({ pathname: '/transfer', params: { property: id, id: x.id } })}
                    last={i === list.length - 1}
                  />
                ))}
              </Block>
              </View>
            ) : null}
          </>
        ) : null}

        <SectionTitle action={<TextLink label={t('Modifier', 'Edit')} onPress={() => router.push({ pathname: '/rules', params: { property: id } })} />}>
          {t('Règles de calcul', 'Calculation rules')}
        </SectionTitle>
        <Block>
          {rule?.commission_rate ? <Row title={t('Ma commission', 'My commission')} subtitle={t('Prélevée sur chaque réservation, avant partage', 'Taken from each booking, before sharing')} value={formatPercent(rule.commission_rate)} /> : null}
          {(rule?.shares ?? []).map((s, i, list) => (
            <Row
              key={s.party_id}
              title={nameOf(s.party_id)}
              subtitle={t(`${formatPercent(s.revenue)} des revenus, ${formatPercent(s.expense)} des dépenses`, `${formatPercent(s.revenue)} of income, ${formatPercent(s.expense)} of expenses`)}
              last={i === list.length - 1}
            />
          ))}
          {!rule ? <Row title={t('Aucune règle : tout est pour moi', 'No rule: everything is mine')} last /> : null}
        </Block>
        {rules.length > 1 ? (
          <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
            {t(`Règles en vigueur depuis ${monthLabel(rule!.effective_from, locale).toLowerCase()}. ${rules.length - 1} version(s) antérieure(s) conservée(s) pour les mois d’avant.`, `In force since ${monthLabel(rule!.effective_from, locale)}. ${rules.length - 1} earlier version(s) kept for the months before.`)}
          </T>
        ) : null}

        <SectionTitle action={<TextLink label={t('Ajouter', 'Add')} onPress={() => router.push({ pathname: '/recurring', params: { property: id } })} />}>
          {t('Dépenses récurrentes', 'Recurring expenses')}
        </SectionTitle>
        {recurring.length ? (
          <Block>
            {recurring.map((r, i) => (
              <Row
                key={r.id}
                title={r.description || categoryLabel(r.category, locale)}
                subtitle={[categoryLabel(r.category, locale), r.vendor, t(`le ${r.day} du mois`, `on day ${r.day}`), r.end_month ? t(`jusqu’en ${monthLabel(r.end_month, locale).toLowerCase()}`, `until ${monthLabel(r.end_month, locale)}`) : null].filter(Boolean).join(', ')}
                value={r.currency === data.profile.currency ? money(base(r)) : formatMoney(r.amount, r.currency)}
                onPress={() => router.push({ pathname: '/recurring', params: { property: id, id: r.id } })}
                last={i === recurring.length - 1}
              />
            ))}
          </Block>
        ) : (
          <T color={color.inkSoft}>{t('Loyer, internet, abonnement… Saisis-les une fois, ils s’ajoutent seuls chaque mois.', 'Rent, internet, subscriptions… Enter them once and they add themselves every month.')}</T>
        )}

        {others.length ? (
          <>
            <SectionTitle>{t('Relevés partagés', 'Shared statements')}</SectionTitle>
            <T color={color.inkSoft} style={{ marginBottom: space.md }}>
              {t('Un relevé est une copie figée, lisible avec un lien. Il ne contient jamais mes frais privés ni mes autres biens.', 'A statement is a frozen copy, readable with a link. It never contains my private costs or my other properties.')}
            </T>
            {shares.length ? (
              <Block>
                {shares.map((s, i) => (
                  <Row
                    key={s.id}
                    title={s.title}
                    subtitle={t(`Pour ${nameOf(s.party_id)}, publié le ${dayLabel(s.created_at.slice(0, 10), locale)}`, `For ${nameOf(s.party_id)}, published ${dayLabel(s.created_at.slice(0, 10), locale)}`)}
                    note={copied === s.id ? t('lien copié', 'link copied') : t('copier le lien', 'copy link')}
                    onPress={() => {
                      void Clipboard.setStringAsync(shareUrl(s.token));
                      setCopied(s.id);
                    }}
                    last={i === shares.length - 1}
                  />
                ))}
              </Block>
            ) : null}
            <View style={{ gap: space.sm, marginTop: space.md }}>
              <Button tone="dark" icon="share" label={t('Publier un relevé', 'Publish a statement')} onPress={() => router.push({ pathname: '/share', params: { property: id } })} />
              {shares.length ? <TextLink label={t('Retirer tous les liens publiés', 'Withdraw every published link')} tint={color.negative} onPress={() => void useStore.getState().revokeShares(shares.map((s) => s.id))} /> : null}
            </View>
          </>
        ) : null}
      </FormScreenBody>
    </View>
  );
}

/** Scrolling body under the coloured header. */
function FormScreenBody({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl * 2 }}>
      <Column>{children}</Column>
    </ScrollView>
  );
}
