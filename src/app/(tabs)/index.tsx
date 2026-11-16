/**
 * Month: the screen opened every day. The result of the month first, then the
 * key figures, the trend, the split between parties, and every entry.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { type Statement, base, monthStatement, nightsOf, occupancy, ruleFor, series } from '@/core/calc';
import { addMonths, currentMonth, monthRange } from '@/core/dates';
import { type Insight, insightsFor } from '@/core/insights';
import { formatMoney } from '@/core/money';
import type { Booking, Expense, Property } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useMoney, useSelection } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { type Translate, categoryLabel, dayLabel, monthLabel, monthShort, shareLabel, useLocale, useT } from '@/i18n';
import { Bars, Breakdown, Legend, Progress, Ring, Tile, Tiles } from '@/ui/charts';
import { Button, Dot, Empty, Notice, Row, SectionTitle, Tag, TextLink } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block, Card, Cols, Screen, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentDot, platformColor, seriesColors, space } from '@/ui/theme';

export default function MonthScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const wide = useWide();
  const data = useData();
  const month = useStore((s) => s.month);
  const setMonth = useStore((s) => s.setMonth);
  const { property, active } = useSelection();
  const id = property?.id ?? null;

  const s = useMemo(() => monthStatement(data, id, month), [data, id, month]);
  const occ = useMemo(() => occupancy(data, id, [month]), [data, id, month]);
  const recent = useMemo(() => series(data, id, monthRange(addMonths(month, -5), month)), [data, id, month]);
  const insights = useMemo(() => insightsFor(data, id, month), [data, id, month]);
  const byId = useMemo(() => new Map(data.properties.map((p) => [p.id, p])), [data.properties]);

  const bookings = [...s.bookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
  const expenses = [...s.expenseRows].sort((a, b) => a.date.localeCompare(b.date));
  const categories = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  const tints = seriesColors();

  if (!active.length) {
    return (
      <Screen reading>
        <PageHeader title={t('Bienvenue', 'Welcome')} filter={false} />
        <Empty title={t('Commence par un bien', 'Start with a property')} text={t('Ajoute un logement à la main, ou importe ton classeur Excel : les revenus, dépenses et règles de partage sont repris tels quels.', 'Add a place by hand, or import your Excel workbook: income, expenses and sharing rules come along as they are.')}>
          <Button label={t('Importer mon classeur Excel', 'Import my Excel workbook')} icon="download" onPress={() => router.push('/import')} />
          <Button tone="quiet" label={t('Ajouter un bien', 'Add a property')} onPress={() => router.push('/property-form')} />
        </Empty>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title={monthLabel(month, locale)} stepper={{ onPrev: () => setMonth(addMonths(month, -1)), onNext: () => setMonth(addMonths(month, 1)), onReset: () => setMonth(currentMonth()) }} />

      <Cols ratio={[2, 3]} gap={space.xl}>
        <Summary s={s} property={property} />
        <View style={{ marginTop: wide ? 0 : space.xl }}>
          <Tiles wide={false}>
            {[
              <Tile key="in" label={t('Revenus', 'Income')} value={money(s.revenue)} note={t(`${bookings.length} versement${bookings.length > 1 ? 's' : ''}`, `${bookings.length} payout${bookings.length > 1 ? 's' : ''}`)} tint={color.tintIncome} />,
              <Tile key="out" label={t('Dépenses', 'Expenses')} value={money(s.expenses)} note={s.rent ? t(`dont loyer ${money(s.rent)}`, `incl. rent ${money(s.rent)}`) : undefined} tint={color.tintExpense} />,
              <Tile
                key="occ"
                label={t('Occupation', 'Occupancy')}
                value={`${Math.round(occ.rate * 100)} %`}
                note={t(`${occ.booked} nuits sur ${occ.available}`, `${occ.booked} of ${occ.available} nights`)}
                tint={color.tintOccupancy}
                aside={<Ring value={occ.rate} size={44} stroke={6} />}
              />,
              property ? (
                <Tile key="night" label={t('Revenu par nuit', 'Income per night')} value={s.avgPerNight ? money(s.avgPerNight) : '—'} note={s.breakEvenPerNight ? t(`équilibre à ${money(s.breakEvenPerNight)}`, `break-even at ${money(s.breakEvenPerNight)}`) : undefined} tint={color.tintNight} />
              ) : (
                <Tile key="fee" label={t('Mes commissions', 'My commissions')} value={money(s.commission)} tint={color.tintNight} />
              ),
            ]}
          </Tiles>
        </View>
      </Cols>

      {insights.length ? (
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          {insights.map((ins, i) => (
            <Notice key={i} icon={ins.kind === 'rent_gap' ? 'month' : ins.kind === 'spike' ? 'chart' : 'alert'} text={capitalize(insightText(ins, byId.get(ins.property_id), !property, money, locale, t))} />
          ))}
        </View>
      ) : null}

      <Cols ratio={[3, 2]}>
        <View>
          <SectionTitle>{t('Les six derniers mois', 'The last six months')}</SectionTitle>
          <Card>
            <Bars points={recent.map((p) => ({ key: p.month, label: monthShort(p.month, locale), income: p.revenue, expenses: p.expenses }))} selected={month} onSelect={setMonth} />
            <View style={{ marginTop: space.md }}>
              <Legend items={[{ label: t('Revenus', 'Income'), tint: color.chartIncome }, { label: t('Dépenses', 'Expenses'), tint: color.chartExpense }]} />
            </View>
          </Card>
          {categories.length ? (
            <>
              <SectionTitle>{t('Où part l’argent ce mois-ci', 'Where the money goes this month')}</SectionTitle>
              <Breakdown items={categories.map(([key, value], i) => ({ label: categoryLabel(key, locale), value, tint: tints[i % tints.length] }))} format={money} />
            </>
          ) : null}
        </View>
        {property ? <Split s={s} property={property} /> : <Portfolio />}
      </Cols>

      <Cols>
        <View>
          <SectionTitle action={<TextLink label={t('Ajouter', 'Add')} onPress={() => router.push({ pathname: '/entry', params: { type: 'booking' } })} />}>{t('Revenus', 'Income')}</SectionTitle>
          {bookings.length ? (
            <Block>
              {bookings.map((b, i) => (
                <BookingRow key={b.id} booking={b} property={property ? undefined : byId.get(b.property_id)} last={i === bookings.length - 1} />
              ))}
            </Block>
          ) : (
            <T color={color.inkSoft}>{t('Aucun revenu ce mois-ci.', 'No income this month.')}</T>
          )}
        </View>
        <View>
          <SectionTitle action={<TextLink label={t('Ajouter', 'Add')} onPress={() => router.push({ pathname: '/entry', params: { type: 'expense' } })} />}>{t('Dépenses', 'Expenses')}</SectionTitle>
          {expenses.length ? (
            <Block>
              {expenses.map((x, i) => (
                <ExpenseRow key={x.id} expense={x} property={property ? undefined : x.property_id ? byId.get(x.property_id) : undefined} last={i === expenses.length - 1} />
              ))}
            </Block>
          ) : (
            <T color={color.inkSoft}>{t('Aucune dépense ce mois-ci.', 'No expenses this month.')}</T>
          )}
        </View>
      </Cols>
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The result of the month, and how far income is from the rent and from break-even. */
function Summary({ s, property }: { s: Statement; property: Property | null }) {
  const t = useT();
  const money = useMoney();
  const value = property ? s.net : s.mine;
  const empty = !s.bookings.length && !s.expenseRows.length;
  const managed = property?.kind === 'managed';
  return (
    <View>
      <T variant="label" color={color.inkSoft}>
        {property ? t('Résultat du mois', 'Result of the month') : t('Ce que le mois me rapporte', 'What the month earns me')}
      </T>
      <T variant="hero" tabular color={empty ? color.inkFaint : value < 0 ? color.negative : color.positive} numberOfLines={1} adjustsFontSizeToFit>
        {money(value, { sign: true })}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
        {empty ? <Tag label={t('Rien d’enregistré ce mois-ci', 'Nothing recorded this month')} /> : null}
        {s.rentCovered === true ? <Tag tone="positive" label={t('Loyer couvert', 'Rent covered')} /> : null}
        {s.rentCovered === false ? <Tag tone="negative" label={t('Loyer non couvert', 'Rent not covered')} /> : null}
        {property && s.parties.length > 1 ? <Tag label={t(`Pour moi : ${money(s.mine, { sign: true })}`, `For me: ${money(s.mine, { sign: true })}`)} /> : null}
        {managed && s.commission ? <Tag label={t(`dont ${money(s.commission)} de commission`, `incl. ${money(s.commission)} commission`)} /> : null}
      </View>
      {property && (s.rent > 0 || s.expenses > 0) ? (
        <View style={{ gap: space.lg, marginTop: space.xl }}>
          {s.rent > 0 ? (
            <Progress
              label={t(`Loyer de ${money(s.rent)}`, `Rent of ${money(s.rent)}`)}
              value={s.revenue}
              target={s.rent}
              done={s.revenue >= s.rent}
              note={s.revenue >= s.rent ? t('couvert', 'covered') : t(`il manque ${money(s.rent - s.revenue)}`, `${money(s.rent - s.revenue)} short`)}
            />
          ) : null}
          {s.expenses > 0 ? (
            <Progress
              label={t(`Équilibre à ${money(s.expenses)}`, `Break-even at ${money(s.expenses)}`)}
              value={s.revenue}
              target={s.expenses}
              done={s.net >= 0}
              note={s.net >= 0 ? t('atteint', 'reached') : t(`il manque ${money(-s.net)}`, `${money(-s.net)} short`)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Who gets what this month, on one property. */
function Split({ s, property }: { s: Statement; property: Property }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const month = useStore((st) => st.month);
  const rule = ruleFor(data.rules, property.id, month);
  const lines = [...s.parties].sort((a, b) => Number(b.party.is_me) - Number(a.party.is_me));
  const solo = lines.length <= 1 && !s.commission && !s.privateExpenses;

  return (
    <View>
      <SectionTitle action={<TextLink label={t('Règles', 'Rules')} onPress={() => router.push({ pathname: '/rules', params: { property: property.id } })} />}>{t('Répartition', 'Split')}</SectionTitle>
      {!rule ? (
        <Notice text={t('Aucune règle de partage pour ce bien : tout est compté pour moi.', 'No sharing rule for this property yet: everything counts as mine.')} />
      ) : solo ? (
        <T color={color.inkSoft}>{t('Ce bien est à moi seule : le résultat du mois me revient en entier.', 'This place is mine alone: the whole result of the month is mine.')}</T>
      ) : (
        <Block>
          {lines.map((line) => {
            const share = rule.shares.find((x) => x.party_id === line.party.id);
            const parts = [shareLabel(share, locale)].filter(Boolean);
            if (line.party.is_me && line.commission) parts.push(t(`commission ${money(line.commission)}`, `commission ${money(line.commission)}`));
            return <Row key={line.party.id} title={line.party.is_me ? t('Moi', 'Me') : line.party.name} subtitle={parts.join(', ') || undefined} value={money(line.net, { sign: true })} valueColor={line.net < 0 ? color.negative : color.ink} />;
          })}
          {s.privateExpenses ? <Row title={t('Mes frais privés', 'My private costs')} subtitle={t('Jamais visibles dans un relevé partagé', 'Never shown in a shared statement')} value={money(-s.privateExpenses)} leading={<Icon name="lock" size={16} color={color.inkSoft} />} /> : null}
          {s.privateExpenses ? <Row title={t('Pour moi ce mois-ci', 'For me this month')} value={money(s.mine, { sign: true })} valueColor={s.mine < 0 ? color.negative : color.positive} /> : null}
        </Block>
      )}
    </View>
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
    <View>
      <SectionTitle>{t('Par bien', 'By property')}</SectionTitle>
      <Block>
        {active.map((p, i) => {
          const s = monthStatement(data, p.id, month);
          return (
            <Row
              key={p.id}
              title={p.name}
              subtitle={t(`Résultat ${money(s.net, { sign: true })}, ${s.nights} nuits`, `Result ${money(s.net, { sign: true })}, ${s.nights} nights`)}
              value={money(s.mine, { sign: true })}
              valueColor={s.mine < 0 ? color.negative : color.ink}
              note={t('pour moi', 'for me')}
              leading={<Dot tint={pigmentDot(p.color)} size={10} />}
              onPress={() => setProperty(p.id)}
              last={i === active.length - 1}
            />
          );
        })}
      </Block>
    </View>
  );
}

function BookingRow({ booking: b, property, last }: { booking: Booking; property?: Property; last: boolean }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const currency = useStore((s) => s.data.profile.currency);
  const n = nightsOf(b);
  const stay = b.check_out ? `${dayLabel(b.check_in, locale)} – ${dayLabel(b.check_out, locale)}` : dayLabel(b.check_in, locale);
  return (
    <Row
      title={b.guest ? `${b.platform}, ${b.guest}` : b.platform}
      subtitle={[property?.name, stay, n ? t(`${n} nuit${n > 1 ? 's' : ''}`, `${n} night${n > 1 ? 's' : ''}`) : null].filter(Boolean).join(', ')}
      value={money(base(b), { sign: true })}
      valueColor={color.positive}
      note={b.currency !== currency ? formatMoney(b.amount, b.currency) : undefined}
      leading={<Dot tint={platformColor(b.platform)} size={10} />}
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
      leading={x.recurring_id ? <Icon name="repeat" size={15} color={color.inkFaint} /> : x.scope === 'private' ? <Icon name="lock" size={15} color={color.inkFaint} /> : <View style={{ width: 15 }} />}
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
