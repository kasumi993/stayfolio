/**
 * One property: who owes whom, its rules, its recurring expenses and the
 * statements shared with its owner or partner. Opened with ?id=…
 */
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { type Balance, type Payback, balances, base, payback, ruleFor, treasury } from '@/core/calc';
import { currentMonth } from '@/core/dates';
import { formatMoney, formatPercent } from '@/core/money';
import type { Property, Rule, Transfer } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useMoney, usePartiesOf } from '@/features/hooks';
import { shareUrl } from '@/features/links';
import { PageHeader } from '@/features/PageHeader';
import { categoryLabel, dayLabel, de, durationLabel, kindLabel, monthLabel, shareLabel, useLocale, useT } from '@/i18n';
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
  const pb = useMemo(() => payback(data, id, currentMonth()), [data, id]);
  const cash = useMemo(() => treasury(data, id), [data, id]);

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
  const together = property.kind === 'partnership' && pb !== null;
  const me = parties.find((p) => p.is_me)?.id;
  const nameOf = (pid: string | null) => {
    const p = parties.find((x) => x.id === pid);
    return p?.is_me ? t('Moi', 'Me') : (p?.name ?? '');
  };

  /** "Mon apport", "Versé à Awa"… or "Moi → M. Diop" between two people. */
  const movement = (x: Transfer) => {
    const putIn = x.to_party === null || (together && x.to_party === me);
    const takenOut = x.from_party === null || (together && x.from_party === me);
    if (putIn && x.from_party) return x.from_party === me ? t('Mon apport', 'My contribution') : t(`Apport ${de(nameOf(x.from_party))}`, `Paid in by ${nameOf(x.from_party)}`);
    if (takenOut && x.to_party) return x.to_party === me ? t('Versé à moi', 'Paid out to me') : t(`Versé à ${nameOf(x.to_party)}`, `Paid out to ${nameOf(x.to_party)}`);
    return `${nameOf(x.from_party)} → ${nameOf(x.to_party)}`;
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
              {together ? (
                <Together property={property} payback={pb} balances={bal} rule={rule} cash={cash} />
              ) : (
                others.map((b) => <Owed key={b.party.id} property={property} b={b} />)
              )}

              <SectionTitle action={<TextLink label={t('Noter un versement', 'Record a payment')} onPress={() => router.push({ pathname: '/transfer', params: { property: id } })} />}>{together ? t('Apports et versements', 'Contributions and payments') : t('Versements', 'Payments')}</SectionTitle>
              {transfers.length ? (
                <Block>
                  {transfers.slice(0, 8).map((x, i, list) => (
                    <Row
                      key={x.id}
                      title={movement(x)}
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
              <Row key={s.party_id} title={nameOf(s.party_id)} subtitle={shareLabel(s, locale) || undefined} last={i === list.length - 1} />
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

/** A managed or shared property settled as we go: who owes whom today. */
function Owed({ property, b }: { property: Property; b: Balance }) {
  const t = useT();
  const money = useMoney();
  return (
    <View style={{ marginBottom: space.lg }}>
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
        <Row title={t(`Part du résultat ${de(b.party.name)}`, `${b.party.name}’s share of the result`)} value={money(b.entitled, { sign: true })} />
        {b.received ? <Row title={t('Revenus encaissés directement', 'Income collected directly')} value={money(-b.received)} /> : null}
        {b.paid ? <Row title={t('Dépenses payées de sa poche', 'Expenses paid out of pocket')} value={money(b.paid, { sign: true })} /> : null}
        {b.transfersOut ? <Row title={t(`Déjà versé par ${b.party.name}`, `Already paid in by ${b.party.name}`)} value={money(b.transfersOut, { sign: true })} /> : null}
        {b.transfersIn ? <Row title={t('Déjà reçu de moi', 'Already received from me')} value={money(-b.transfersIn)} last /> : null}
      </Block>
    </View>
  );
}

/**
 * A partnership: the partners funded the set-up, income stays in the business
 * to pay the running costs, and what is left over is shared now and then. So
 * the page answers two questions: how much profit is there to share, and has
 * the property paid back what it cost to set up.
 */
function Together({ property, payback: pb, balances: bal, rule, cash }: { property: Property; payback: Payback; balances: Balance[]; rule: Rule | null; cash: number }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const sorted = [...bal].sort((a, b) => Number(b.party.is_me) - Number(a.party.is_me));
  const left = -pb.cumulative;
  const pace = money(pb.pace, { sign: true });
  const months = t(`${pb.paceMonths} dernier${pb.paceMonths > 1 ? 's' : ''} mois complet${pb.paceMonths > 1 ? 's' : ''}`, `last ${pb.paceMonths} complete month${pb.paceMonths > 1 ? 's' : ''}`);
  const outlook = left < 1 || !pb.paceMonths
    ? null
    : pb.monthsLeft
      ? t(`Au rythme des ${months} (${pace} par mois), il faudrait encore ${durationLabel(pb.monthsLeft, locale)}.`, `At the pace of the ${months} (${pace} a month), it would take another ${durationLabel(pb.monthsLeft, locale)}.`)
      : t(`Sur les ${months}, le résultat moyen est de ${pace} par mois : à ce rythme, la mise de départ ne se récupère pas.`, `Over the ${months}, the average result is ${pace} a month: at that pace, the initial outlay is never recovered.`);
  return (
    <View style={{ marginBottom: space.lg }}>
      <Card tint={pigmentOf(property.color)}>
        <T variant="label" color={color.inkSoft}>
          {t('Bénéfice depuis le début', 'Profit since the beginning')}
        </T>
        <T variant="title" tabular color={pb.profit < -1 ? color.negative : color.ink} style={{ marginTop: 2 }}>
          {money(pb.profit, { sign: true })}
        </T>
        <T variant="small" color={color.inkSoft} style={{ marginTop: 2 }}>
          {pb.profit > 1
            ? t('Revenus moins dépenses courantes. À partager selon les parts ci-dessous.', 'Income minus running costs. To be shared as shown below.')
            : t('Revenus moins dépenses courantes. Rien à partager pour l’instant.', 'Income minus running costs. Nothing to share for now.')}
        </T>
      </Card>
      <Block>
        {sorted.map((b, i) => (
          <Row
            key={b.party.id}
            title={b.party.is_me ? t('Ma part', 'My share') : t(`Part ${de(b.party.name)}`, `${b.party.name}’s share`)}
            subtitle={shareLabel(rule?.shares.find((x) => x.party_id === b.party.id), locale) || undefined}
            value={money(b.entitled, { sign: true })}
            valueColor={b.entitled < 0 ? color.negative : color.ink}
            last={i === sorted.length - 1 && !sorted.some((o) => o.drawn)}
          />
        ))}
        {sorted
          .filter((b) => b.drawn)
          .flatMap((b, i, list) => [
            <Row key={b.party.id + 'out'} title={b.party.is_me ? t('Déjà versé à moi', 'Already paid out to me') : t(`Déjà versé à ${b.party.name}`, `Already paid out to ${b.party.name}`)} value={money(-b.drawn)} />,
            <Row key={b.party.id + 'due'} title={b.party.is_me ? t('Reste à me verser', 'Still to pay out to me') : t(`Reste à verser à ${b.party.name}`, `Still to pay out to ${b.party.name}`)} value={money(b.undistributed, { sign: true })} last={i === list.length - 1} />,
          ])}
      </Block>

      <SectionTitle>{t('Caisse', 'Cash')}</SectionTitle>
      <Block>
        {sorted.map((b) => (
          <Row
            key={b.party.id}
            title={b.party.is_me ? t('Mes apports', 'My contributions') : t(`Apports ${de(b.party.name)}`, `Paid in by ${b.party.name}`)}
            subtitle={b.party.is_me && !b.contributed ? t('Aucun apport noté : ajoute-le avec « Noter un versement »', 'None recorded: add it with “Record a payment”') : undefined}
            value={money(b.contributed)}
          />
        ))}
        <Row
          title={t('En caisse aujourd’hui', 'Cash on hand today')}
          subtitle={t('Apports et revenus encaissés, moins tout ce qui a été payé ou versé', 'Paid in and collected, minus everything paid or paid out')}
          value={money(cash, { sign: cash < 0 })}
          valueColor={cash < 0 ? color.negative : color.ink}
          last
        />
      </Block>

      <SectionTitle>{t('Mise de départ', 'Initial outlay')}</SectionTitle>
      <Block>
        <Row
          title={t('Dépenses de mise en place', 'Set-up costs')}
          subtitle={pb.setup ? t('Payées par les apports, hors bénéfice', 'Paid out of the contributions, outside the profit') : t('Aucune dépense n’est marquée « mise en place »', 'No expense is marked as a set-up cost')}
          value={money(pb.setup)}
        />
        <Row
          title={left >= 1 ? t('Reste à récupérer', 'Still to recover') : t('Mise de départ récupérée', 'Initial outlay recovered')}
          subtitle={t('Mise en place, moins le bénéfice depuis le début', 'Set-up costs, minus the profit since the beginning')}
          value={left >= 1 ? money(left) : undefined}
          last
        />
      </Block>
      {outlook ? (
        <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
          {outlook}
        </T>
      ) : null}
    </View>
  );
}
