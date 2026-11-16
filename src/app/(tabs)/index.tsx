/**
 * Month: the screen opened every day. One sentence says where the month
 * stands, then the nights, the split between parties, and every entry.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { type Statement, base, monthStatement, nightsOf, ruleFor } from '@/core/calc';
import { addMonths, currentMonth } from '@/core/dates';
import { type Insight, insightsFor } from '@/core/insights';
import { formatMoney, formatPercent } from '@/core/money';
import type { Booking, Expense, Property } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { Hero, HeroFacts, Stepper } from '@/features/Hero';
import { useMoney, useSelection } from '@/features/hooks';
import { type Translate, categoryLabel, dayLabel, monthLabel, useLocale, useT } from '@/i18n';
import { Legend, Nights } from '@/ui/charts';
import { Button, Dot, Empty, Notice, Row, SectionTitle, TextLink } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block, Screen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentDot, platformColor, space } from '@/ui/theme';

export default function MonthScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const month = useStore((s) => s.month);
  const setMonth = useStore((s) => s.setMonth);
  const { property, active } = useSelection();

  const s = useMemo(() => monthStatement(data, property?.id ?? null, month), [data, property, month]);
  const insights = useMemo(() => insightsFor(data, property?.id ?? null, month), [data, property, month]);
  const byId = useMemo(() => new Map(data.properties.map((p) => [p.id, p])), [data.properties]);

  const bookings = [...s.bookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
  const expenses = [...s.expenseRows].sort((a, b) => a.date.localeCompare(b.date));
  const platforms = [...new Set(bookings.map((b) => b.platform))];

  if (!active.length) {
    return (
      <Screen header={<Hero>{<Headline text={t('Bienvenue.', 'Welcome.')} />}</Hero>}>
        <Empty title={t('Commence par un bien', 'Start with a property')} text={t('Ajoute un logement à la main, ou importe ton classeur Excel : les revenus, dépenses et règles de partage sont repris tels quels.', 'Add a place by hand, or import your Excel workbook: income, expenses and sharing rules come along as they are.')}>
          <Button label={t('Importer mon classeur Excel', 'Import my Excel workbook')} icon="download" onPress={() => router.push('/import')} />
          <Button tone="quiet" label={t('Ajouter un bien', 'Add a property')} onPress={() => router.push('/property/new')} />
        </Empty>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <Hero>
          <Stepper label={monthLabel(month, locale)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onLabelPress={() => setMonth(currentMonth())} />
          <Headline text={headline(s, property, money, t)} />
          {property ? <RentLine s={s} /> : null}
          {property ? (
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Nights bookings={bookings} month={month} />
              {platforms.length ? <Legend onHero items={platforms.map((p) => ({ label: p, tint: platformColor(p) }))} /> : null}
            </View>
          ) : null}
          <HeroFacts
            facts={[
              { label: t('Revenus', 'Income'), value: money(s.revenue) },
              { label: t('Dépenses', 'Expenses'), value: money(s.expenses) },
              property
                ? { label: t('Par nuit', 'Per night'), value: s.avgPerNight ? money(s.avgPerNight) : '—' }
                : { label: t('Commissions', 'Commissions'), value: money(s.commission) },
            ]}
          />
        </Hero>
      }>
      {insights.length ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {insights.map((ins, i) => (
            <Notice key={i} icon={ins.kind === 'rent_gap' ? 'month' : ins.kind === 'spike' ? 'chart' : 'alert'} text={capitalize(insightText(ins, byId.get(ins.property_id), !property, money, locale, t))} />
          ))}
        </View>
      ) : null}

      {property ? <Split s={s} property={property} /> : <Portfolio />}

      <SectionTitle action={<TextLink label={t('Ajouter', 'Add')} onPress={() => router.push({ pathname: '/entry', params: { type: 'booking' } })} />}>
        {t('Revenus', 'Income')}
      </SectionTitle>
      {bookings.length ? (
        <Block>
          {bookings.map((b, i) => (
            <BookingRow key={b.id} booking={b} property={property ? undefined : byId.get(b.property_id)} last={i === bookings.length - 1} />
          ))}
        </Block>
      ) : (
        <T color={color.inkSoft}>{t('Aucun revenu ce mois-ci.', 'No income this month.')}</T>
      )}

      <SectionTitle action={<TextLink label={t('Ajouter', 'Add')} onPress={() => router.push({ pathname: '/entry', params: { type: 'expense' } })} />}>
        {t('Dépenses', 'Expenses')}
      </SectionTitle>
      {expenses.length ? (
        <Block>
          {expenses.map((x, i) => (
            <ExpenseRow key={x.id} expense={x} property={property ? undefined : x.property_id ? byId.get(x.property_id) : undefined} last={i === expenses.length - 1} />
          ))}
        </Block>
      ) : (
        <T color={color.inkSoft}>{t('Aucune dépense ce mois-ci.', 'No expenses this month.')}</T>
      )}
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const Headline = ({ text }: { text: string }) => (
  <T variant="title" color={color.onHero} style={{ marginTop: space.md, minHeight: 64 }}>
    {text}
  </T>
);

/** The month in one sentence, the way its owner would put it. */
function headline(s: Statement, property: Property | null, money: (v: number) => string, t: Translate): string {
  if (!s.bookings.length && !s.expenseRows.length) return t('Rien d’enregistré ce mois-ci.', 'Nothing recorded this month.');
  if (!property) return s.mine >= 0 ? t(`Ce mois me rapporte ${money(s.mine)}.`, `This month earns me ${money(s.mine)}.`) : t(`Ce mois me coûte ${money(-s.mine)}.`, `This month costs me ${money(-s.mine)}.`);
  if (s.rentCovered === false) return t(`Il manque ${money(s.rent - s.revenue)} pour couvrir le loyer.`, `${money(s.rent - s.revenue)} short of covering the rent.`);
  if (s.net < 0) return s.rentCovered ? t(`Loyer couvert. Encore ${money(-s.net)} avant l’équilibre.`, `Rent covered. ${money(-s.net)} to go before breaking even.`) : t(`Encore ${money(-s.net)} avant l’équilibre.`, `${money(-s.net)} to go before breaking even.`);
  if (property.kind === 'managed' && s.commission > 0) return t(`${money(s.commission)} de commission ce mois-ci.`, `${money(s.commission)} in commission this month.`);
  return t(`Mois bénéficiaire : ${money(s.net)}.`, `In profit this month: ${money(s.net)}.`);
}

/** Revenue as a bar, with a tick where the rent sits and one at break-even. */
function RentLine({ s }: { s: Statement }) {
  const t = useT();
  const money = useMoney();
  if (!s.revenue && !s.expenses) return null;
  const scale = Math.max(s.revenue, s.expenses, 1) * 1.04;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%` as const;
  const marks = [
    { key: 'rent', value: s.rent, label: t('Loyer', 'Rent') },
    { key: 'even', value: s.expenses, label: t('Équilibre', 'Break-even') },
  ].filter((m) => m.value > 0 && (m.key === 'even' || s.rent < s.expenses));
  return (
    <View style={{ marginTop: space.md }}>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: color.heroTrack }}>
        <View style={{ width: pct(s.revenue), height: 12, borderRadius: 6, backgroundColor: color.heroBar }} />
        {marks.map((m) => (
          <View key={m.key} style={{ position: 'absolute', left: pct(m.value), top: -5, width: 2.5, height: 22, marginLeft: -1.25, borderRadius: 2, backgroundColor: color.onHero }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 2, marginTop: space.md }}>
        {marks.map((m) => (
          <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {s.revenue >= m.value ? <Icon name="check" size={14} color={color.heroMark} weight={3} /> : <View style={{ width: 2.5, height: 12, borderRadius: 2, backgroundColor: color.onHero }} />}
            <T variant="small" color={color.onHeroSoft}>
              {m.label} {money(m.value)}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Who gets what this month, on one property. */
function Split({ s, property }: { s: Statement; property: Property }) {
  const t = useT();
  const money = useMoney();
  const data = useData();
  const month = useStore((st) => st.month);
  const rule = ruleFor(data.rules, property.id, month);
  const lines = [...s.parties].sort((a, b) => Number(b.party.is_me) - Number(a.party.is_me));
  const solo = lines.length <= 1 && !s.commission && !s.privateExpenses;

  return (
    <>
      <SectionTitle action={<TextLink label={t('Règles', 'Rules')} onPress={() => router.push({ pathname: '/rules', params: { property: property.id } })} />}>
        {t('Répartition', 'Split')}
      </SectionTitle>
      {!rule ? (
        <Notice text={t('Aucune règle de partage pour ce bien : tout est compté pour moi.', 'No sharing rule for this property yet: everything counts as mine.')} />
      ) : solo ? (
        <T color={color.inkSoft}>{t('Ce bien est à moi seule : le résultat du mois me revient en entier.', 'This place is mine alone: the whole result of the month is mine.')}</T>
      ) : (
        <Block>
          {lines.map((line) => {
            const share = rule.shares.find((x) => x.party_id === line.party.id);
            const parts: string[] = [];
            if (share?.revenue) parts.push(t(`${formatPercent(share.revenue)} des revenus`, `${formatPercent(share.revenue)} of income`));
            if (share?.expense) parts.push(t(`${formatPercent(share.expense)} des dépenses`, `${formatPercent(share.expense)} of expenses`));
            if (line.party.is_me && line.commission) parts.push(t(`commission ${money(line.commission)}`, `commission ${money(line.commission)}`));
            return (
              <Row
                key={line.party.id}
                title={line.party.is_me ? t('Moi', 'Me') : line.party.name}
                subtitle={parts.join(', ') || undefined}
                value={money(line.net, { sign: true })}
                valueColor={line.net < 0 ? color.negative : color.ink}
              />
            );
          })}
          {s.privateExpenses ? <Row title={t('Mes frais privés', 'My private costs')} subtitle={t('Jamais visibles dans un relevé partagé', 'Never shown in a shared statement')} value={money(-s.privateExpenses)} leading={<Icon name="lock" size={18} color={color.inkSoft} />} /> : null}
          {s.privateExpenses ? <Row title={t('Pour moi ce mois-ci', 'For me this month')} value={money(s.mine, { sign: true })} valueColor={s.mine < 0 ? color.negative : color.positive} /> : null}
        </Block>
      )}
    </>
  );
}

/** All properties together: one line each, tap to open it. */
function Portfolio() {
  const t = useT();
  const money = useMoney();
  const data = useData();
  const month = useStore((s) => s.month);
  const setProperty = useStore((s) => s.setProperty);
  const { active } = useSelection();
  return (
    <>
      <SectionTitle>{t('Par bien', 'By property')}</SectionTitle>
      <Block>
        {active.map((p, i) => {
          const s = monthStatement(data, p.id, month);
          return (
            <Row
              key={p.id}
              title={p.name}
              subtitle={t(`${s.nights} nuits, résultat ${money(s.net, { sign: true })}`, `${s.nights} nights, result ${money(s.net, { sign: true })}`)}
              value={money(s.mine, { sign: true })}
              valueColor={s.mine < 0 ? color.negative : color.ink}
              note={t('pour moi', 'for me')}
              leading={<Dot tint={pigmentDot(p.color)} size={12} />}
              onPress={() => setProperty(p.id)}
              last={i === active.length - 1}
            />
          );
        })}
      </Block>
    </>
  );
}

function BookingRow({ booking: b, property, last }: { booking: Booking; property?: Property; last: boolean }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const currency = useStore((s) => s.data.profile.currency);
  const n = nightsOf(b);
  const stay = b.check_out ? `${dayLabel(b.check_in, locale)} → ${dayLabel(b.check_out, locale)}` : dayLabel(b.check_in, locale);
  return (
    <Row
      title={b.guest ? `${b.platform}, ${b.guest}` : b.platform}
      subtitle={[property?.name, stay, n ? t(`${n} nuit${n > 1 ? 's' : ''}`, `${n} night${n > 1 ? 's' : ''}`) : null].filter(Boolean).join(', ')}
      value={money(base(b), { sign: true })}
      valueColor={color.positive}
      note={b.currency !== currency ? formatMoney(b.amount, b.currency) : undefined}
      leading={<Dot tint={platformColor(b.platform)} />}
      onPress={() => router.push({ pathname: '/entry', params: { type: 'booking', id: b.id } })}
      last={last}
    />
  );
}

function ExpenseRow({ expense: x, property, last }: { expense: Expense; property?: Property; last: boolean }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const hasDoc = useStore((s) => s.data.docs.some((d) => d.expense_id === x.id));
  const label = categoryLabel(x.category, locale);
  const title = x.description || x.vendor || label;
  const tags = [x.excluded ? t('exclue ce mois', 'excluded this month') : null, x.scope === 'private' ? t('privée', 'private') : null].filter(Boolean);
  return (
    <Row
      title={title}
      subtitle={[property?.name, label === title ? null : label, x.vendor && x.vendor !== title ? x.vendor : null, dayLabel(x.date, locale), ...tags].filter(Boolean).join(', ')}
      value={money(-base(x))}
      note={hasDoc ? t('reçu joint', 'receipt attached') : undefined}
      leading={x.recurring_id ? <Icon name="repeat" size={17} color={color.inkSoft} /> : x.scope === 'private' ? <Icon name="lock" size={17} color={color.inkSoft} /> : <View style={{ width: 17 }} />}
      dimmed={x.excluded}
      onPress={() => router.push({ pathname: '/entry', params: { type: 'expense', id: x.id } })}
      last={last}
    />
  );
}

function insightText(ins: Insight, property: Property | undefined, showName: boolean, money: (v: number) => string, locale: 'fr' | 'en', t: Translate): string {
  const where = showName && property ? `${property.name} : ` : '';
  switch (ins.kind) {
    case 'rent_gap':
      return where + (ins.nights ? t(`au rythme récent, environ ${ins.nights} nuits de plus couvriraient le loyer.`, `at the recent rate, about ${ins.nights} more nights would cover the rent.`) : t(`le loyer n’est pas encore couvert (${money(ins.missing)} manquants).`, `the rent is not covered yet (${money(ins.missing)} short).`));
    case 'spike':
      return where + t(`${categoryLabel(ins.category, locale)} à ${money(ins.amount)}, contre ${money(ins.usual)} d’habitude.`, `${categoryLabel(ins.category, locale)} at ${money(ins.amount)}, usually ${money(ins.usual)}.`);
    case 'duplicate':
      return where + t(`deux dépenses identiques de ${money(ins.amount)} (${ins.label}). Un doublon ?`, `two identical expenses of ${money(ins.amount)} (${ins.label}). A duplicate?`);
    case 'overlap':
      return where + t(`deux réservations se chevauchent autour du ${dayLabel(ins.check_in, locale)}.`, `two bookings overlap around ${dayLabel(ins.check_in, locale)}.`);
  }
}
