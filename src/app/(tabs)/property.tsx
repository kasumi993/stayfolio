/**
 * One property: who owes whom, its rules, its recurring expenses and the
 * statements shared with its owner or partner. Opened with ?id=…
 */
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { balances, base, ruleFor } from '@/core/calc';
import { currentMonth } from '@/core/dates';
import { formatMoney, formatPercent } from '@/core/money';
import { useData, useStore } from '@/data/store';
import { useMoney, usePartiesOf } from '@/features/hooks';
import { shareUrl } from '@/features/links';
import { PageHeader } from '@/features/PageHeader';
import { categoryLabel, dayLabel, kindLabel, monthLabel, useLocale, useT } from '@/i18n';
import { Button, Empty, Row, SectionTitle, TextLink } from '@/ui/controls';
import { Block, Card, Cols, Screen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentOf, space } from '@/ui/theme';

export default function PropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const property = data.properties.find((p) => p.id === id);
  const parties = usePartiesOf(id);
  const [copied, setCopied] = useState<string | null>(null);
  const bal = useMemo(() => balances(data, id), [data, id]);

  const back = <TextLink label={t('Tous les biens', 'All properties')} onPress={() => router.navigate('/properties')} />;
  if (!property) {
    return (
      <Screen reading>
        <Empty title={t('Ce bien n’existe plus', 'This property no longer exists')} text="">
          {back}
        </Empty>
      </Screen>
    );
  }

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
    <Screen>
      <View style={{ marginBottom: space.sm }}>{back}</View>
      <PageHeader
        title={property.name}
        subtitle={[kindLabel(property.kind, locale), property.location].filter(Boolean).join(', ')}
        filter={false}
        action={<Button compact tone="quiet" icon="edit" label={t('Modifier', 'Edit')} onPress={() => router.push({ pathname: '/property-form', params: { id } })} />}
      />

      <Cols>
        <View>
          {others.length ? (
            <>
              {others.map((b) => (
                <View key={b.party.id} style={{ marginBottom: space.lg }}>
                  <Card tint={pigmentOf(property.color)}>
                    <T variant="label" color={color.inkSoft}>
                      {t('Où on en est, depuis le début', 'Where things stand, since the beginning')}
                    </T>
                    <T variant="title" style={{ marginTop: 2 }}>
                      {Math.abs(b.balance) < 1
                        ? t(`Rien à régler avec ${b.party.name}`, `All settled with ${b.party.name}`)
                        : b.balance > 0
                          ? t(`Je dois ${money(b.balance)} à ${b.party.name}`, `I owe ${b.party.name} ${money(b.balance)}`)
                          : t(`${b.party.name} me doit ${money(-b.balance)}`, `${b.party.name} owes me ${money(-b.balance)}`)}
                    </T>
                  </Card>
                  <Block>
                    <Row title={t(`Part du résultat de ${b.party.name}`, `${b.party.name}’s share of the result`)} value={money(b.entitled, { sign: true })} />
                    {b.received ? <Row title={t('Revenus encaissés directement', 'Income collected directly')} value={money(-b.received)} /> : null}
                    {b.paid ? <Row title={t('Dépenses payées de sa poche', 'Expenses paid out of pocket')} value={money(b.paid, { sign: true })} /> : null}
                    {b.transfersOut ? <Row title={t(`Déjà versé par ${b.party.name}`, `Already paid in by ${b.party.name}`)} value={money(b.transfersOut, { sign: true })} /> : null}
                    {b.transfersIn ? <Row title={t('Déjà reçu de moi', 'Already received from me')} value={money(-b.transfersIn)} /> : null}
                  </Block>
                </View>
              ))}

              <SectionTitle action={<TextLink label={t('Noter un versement', 'Record a payment')} onPress={() => router.push({ pathname: '/transfer', params: { property: id } })} />}>{t('Versements', 'Payments')}</SectionTitle>
              {transfers.length ? (
                <Block>
                  {transfers.slice(0, 8).map((x, i, list) => (
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
              ) : (
                <T color={color.inkSoft}>{t('Aucun versement noté pour l’instant.', 'No payment recorded yet.')}</T>
              )}
            </>
          ) : (
            <Card tint={pigmentOf(property.color)}>
              <T variant="heading">{t('Ce bien est à moi seule', 'This place is mine alone')}</T>
              <T color={color.inkSoft}>{t('Tout le résultat me revient. Pour ajouter un associé ou un propriétaire, modifie les règles.', 'The whole result is mine. To add a partner or an owner, edit the rules.')}</T>
            </Card>
          )}
        </View>

        <View>
          <SectionTitle action={<TextLink label={t('Modifier', 'Edit')} onPress={() => router.push({ pathname: '/rules', params: { property: id } })} />}>{t('Règles de calcul', 'Calculation rules')}</SectionTitle>
          <Block>
            {rule?.commission_rate ? <Row title={t('Ma commission', 'My commission')} subtitle={t('Prélevée sur chaque réservation, avant partage', 'Taken from each booking, before sharing')} value={formatPercent(rule.commission_rate)} /> : null}
            {(rule?.shares ?? []).map((s, i, list) => (
              <Row key={s.party_id} title={nameOf(s.party_id)} subtitle={t(`${formatPercent(s.revenue)} des revenus, ${formatPercent(s.expense)} des dépenses`, `${formatPercent(s.revenue)} of income, ${formatPercent(s.expense)} of expenses`)} last={i === list.length - 1} />
            ))}
            {!rule ? <Row title={t('Aucune règle : tout est pour moi', 'No rule: everything is mine')} last /> : null}
          </Block>
          {rules.length > 1 && rule ? (
            <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
              {t(`En vigueur depuis ${monthLabel(rule.effective_from, locale).toLowerCase()}. Les mois d’avant gardent leurs anciennes règles.`, `In force since ${monthLabel(rule.effective_from, locale)}. Earlier months keep their previous rules.`)}
            </T>
          ) : null}

          <SectionTitle action={<TextLink label={t('Ajouter', 'Add')} onPress={() => router.push({ pathname: '/recurring', params: { property: id } })} />}>{t('Dépenses récurrentes', 'Recurring expenses')}</SectionTitle>
          {recurring.length ? (
            <Block>
              {recurring.map((r, i) => (
                <Row
                  key={r.id}
                  title={r.description || categoryLabel(r.category, locale)}
                  subtitle={[r.vendor, t(`le ${r.day} du mois`, `on day ${r.day}`), r.end_month ? t(`jusqu’en ${monthLabel(r.end_month, locale).toLowerCase()}`, `until ${monthLabel(r.end_month, locale)}`) : null].filter(Boolean).join(', ')}
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
              <View style={{ gap: space.md, marginTop: space.md, alignItems: 'flex-start' }}>
                <Button tone="dark" icon="share" label={t('Publier un relevé', 'Publish a statement')} onPress={() => router.push({ pathname: '/share', params: { property: id } })} />
                {shares.length ? <TextLink label={t('Retirer tous les liens publiés', 'Withdraw every published link')} tint={color.negative} onPress={() => void useStore.getState().revokeShares(shares.map((s) => s.id))} /> : null}
              </View>
            </>
          ) : null}
        </View>
      </Cols>
    </Screen>
  );
}
