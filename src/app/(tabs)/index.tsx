/**
 * Home: the screen opened every day. The result of the month, the buttons to
 * record an expense or an income, the latest entries, then the figures.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { type Statement, monthStatement, occupancy, ruleFor, series } from '@/core/calc';
import { addMonths, currentMonth, monthRange } from '@/core/dates';
import { type Insight, insightsFor } from '@/core/insights';
import type { Property } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { BookingRow, ExpenseRow } from '@/features/EntryRows';
import { useAccess, useMoney, useSelection } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { type Translate, categoryLabel, dayLabel, monthLabel, monthShort, shareLabel, useLocale, useT } from '@/i18n';
import { Bars, Breakdown, Legend, Progress, Ring, Tile, Tiles } from '@/ui/charts';
import { Button, Choice, Dot, Empty, Notice, Row, SectionTitle, Tag, TextLink } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block, Card, Cols, Screen, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, fill, pigmentDot, radius, seriesColors, space } from '@/ui/theme';

export default function MonthScreen() {
  useQuickAdd();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const wide = useWide();
  const data = useData();
  const month = useStore((s) => s.month);
  const setMonth = useStore((s) => s.setMonth);
  const [view, setView] = useState<'figures' | 'entries' | 'charts'>('figures');
  const { property, active } = useSelection();
  const { owner, canEdit, sees } = useAccess();
  const id = property?.id ?? null;
  // Through a member link, the figures need the "report" page.
  const figures = sees('report');

  const s = useMemo(() => monthStatement(data, id, month), [data, id, month]);
  const occ = useMemo(() => occupancy(data, id, [month]), [data, id, month]);
  const recent = useMemo(() => series(data, id, monthRange(addMonths(month, -5), month)), [data, id, month]);
  const insights = useMemo(() => insightsFor(data, id, month), [data, id, month]);
  const byId = useMemo(() => new Map(data.properties.map((p) => [p.id, p])), [data.properties]);

  const bookings = [...s.bookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
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

  const latest = [
    ...data.bookings.filter((b) => sees('income') && (!id || b.property_id === id)).map((b) => ({ kind: 'booking' as const, row: b, at: b.created_at, day: b.check_in })),
    ...data.expenses.filter((x) => sees('expenses') && !x.excluded && (!id || x.property_id === id)).map((x) => ({ kind: 'expense' as const, row: x, at: x.created_at, day: x.date })),
  ]
    // Last recorded first; entries recorded together (an import) by their own date.
    .sort((a, b) => b.at.slice(0, 16).localeCompare(a.at.slice(0, 16)) || b.day.localeCompare(a.day))
    .slice(0, 6);

  return (
    <Screen>
      <PageHeader title={monthLabel(month, locale)} stepper={{ onPrev: () => setMonth(addMonths(month, -1)), onNext: () => setMonth(addMonths(month, 1)), onReset: () => setMonth(currentMonth()) }} />

      <Cols ratio={[2, 3]} gap={space.xl}>
        {figures ? <Summary s={s} property={property} /> : <MemberIntro />}
        <View style={{ marginTop: wide ? 0 : space.xl, gap: space.md }}>
          {canEdit ? <QuickAdd /> : null}
        </View>
      </Cols>

      {/* One view at a time: the page stays light. */}
      <View style={{ marginTop: space.xl, marginBottom: space.md }}>
        <Choice
          value={view}
          onChange={setView}
          options={[
            { value: 'figures', label: t('Chiffres', 'Figures') },
            ...(sees('income') || sees('expenses') ? [{ value: 'entries' as const, label: t('Saisies', 'Entries') }] : []),
            ...(figures ? [{ value: 'charts' as const, label: t('Graphiques', 'Charts') }] : []),
          ]}
        />
      </View>

      {view === 'figures' ? (
        <View style={{ gap: space.md }}>
          <Tiles wide={false}>
            {[
              !sees('income') ? null : <Tile key="in" label={t('Revenus', 'Income')} value={money(s.revenue)} note={t(`${bookings.length} versement${bookings.length > 1 ? 's' : ''}`, `${bookings.length} payout${bookings.length > 1 ? 's' : ''}`)} tint={color.tintIncome} />,
              !sees('expenses') ? null : <Tile key="out" label={t('Dépenses', 'Expenses')} value={money(s.expenses)} note={s.rent ? t(`dont loyer ${money(s.rent)}`, `incl. rent ${money(s.rent)}`) : undefined} tint={color.tintExpense} />,
              !sees('income') ? null : <Tile
                key="occ"
                label={t('Occupation', 'Occupancy')}
                value={`${Math.round(occ.rate * 100)} %`}
                note={t(`${occ.booked} nuits sur ${occ.available}`, `${occ.booked} of ${occ.available} nights`)}
                tint={color.tintOccupancy}
                aside={<Ring value={occ.rate} size={44} stroke={6} />}
              />,
              !figures ? null : property ? (
                <Tile key="night" label={t('Revenu par nuit', 'Income per night')} value={s.avgPerNight ? money(s.avgPerNight) : '—'} note={s.breakEvenPerNight ? t(`équilibre à ${money(s.breakEvenPerNight)}`, `break-even at ${money(s.breakEvenPerNight)}`) : undefined} tint={color.tintNight} />
              ) : (
                <Tile key="fee" label={t('Mes commissions', 'My commissions')} value={money(s.commission)} tint={color.tintNight} />
              ),
            ].filter((x) => x !== null)}
          </Tiles>
          {property && (owner || sees('cash')) ? (
            <Button
              compact
              tone="quiet"
              icon={owner ? 'building' : 'users'}
              label={owner ? t('Fiche du logement : caisse, membres, règles', 'Property page: cash, members, rules') : t('Caisse et apports', 'Cash and contributions')}
              onPress={() => router.push({ pathname: '/property', params: { id: property.id } })}
            />
          ) : null}
          {figures && insights.length ? (
            <Notice icon={insights[0].kind === 'rent_gap' ? 'month' : insights[0].kind === 'spike' ? 'chart' : 'alert'} text={capitalize(insightText(insights[0], byId.get(insights[0].property_id), !property, money, locale, t))} />
          ) : null}
          {!figures ? null : property ? <Split s={s} property={property} /> : <Portfolio />}
        </View>
      ) : null}


      {view === 'entries' ? (
        <View>
          <SectionTitle action={sees('income') || sees('expenses') ? <TextLink label={t('Tout voir', 'See all')} onPress={() => router.push('/entries')} /> : undefined}>{t('Dernières saisies', 'Latest entries')}</SectionTitle>
          {latest.length ? (
            <Block>
              {latest.map((e, i) =>
                e.kind === 'booking' ? (
                  <BookingRow key={e.row.id} booking={e.row} property={property ? undefined : byId.get(e.row.property_id)} last={i === latest.length - 1} />
                ) : (
                  <ExpenseRow key={e.row.id} expense={e.row} property={property ? undefined : e.row.property_id ? byId.get(e.row.property_id) : undefined} last={i === latest.length - 1} />
                ),
              )}
            </Block>
          ) : (
            <T color={color.inkSoft}>{t('Rien d’enregistré pour l’instant.', 'Nothing recorded yet.')}</T>
          )}
        </View>
      ) : null}

      {figures && view === 'charts' ? (
      <Cols ratio={[3, 2]}>
        <View>
          <SectionTitle action={<TextLink label={t('Bilan de l’année', 'Yearly report')} onPress={() => router.push('/reports')} />}>{t('Les six derniers mois', 'The last six months')}</SectionTitle>
          <Card>
            <Bars points={recent.map((p) => ({ key: p.month, label: monthShort(p.month, locale), income: p.revenue, expenses: p.expenses }))} selected={month} onSelect={setMonth} />
            <View style={{ marginTop: space.md }}>
              <Legend items={[{ label: t('Revenus', 'Income'), tint: color.chartIncome }, { label: t('Dépenses', 'Expenses'), tint: color.chartExpense }]} />
            </View>
          </Card>
        </View>
        {categories.length ? (
          <View>
            <SectionTitle>{t('Où part l’argent ce mois-ci', 'Where the money goes this month')}</SectionTitle>
            <Breakdown items={categories.map(([key, value], i) => ({ label: categoryLabel(key, locale), value, tint: tints[i % tints.length] }))} format={money} />
          </View>
        ) : (
          <View />
        )}
      </Cols>
      ) : null}
      {owner ? null : <View style={{ height: space.xl }} />}
    </Screen>
  );
}

/** The three things the app is mostly for, one tap away. */
export function QuickAdd() {
  const t = useT();
  const { sees } = useAccess();
  const go = (type: 'expense' | 'booking') => router.push({ pathname: '/entry', params: { type } });
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {sees('expenses') ? <BigButton label={t('Dépense', 'Expense')} icon="minus" tint={color.tintExpense} ink={color.negative} onPress={() => go('expense')} /> : null}
        {sees('income') ? <BigButton label={t('Revenu', 'Income')} icon="plus" tint={color.tintIncome} ink={color.positive} onPress={() => go('booking')} /> : null}
      </View>
      {sees('invoices') ? <Button compact tone="quiet" icon="receipt" label={t('Ajouter une facture', 'Add an invoice')} onPress={() => router.push('/documents')} /> : null}
    </View>
  );
}

function BigButton({ label, icon, tint, ink, onPress }: { label: string; icon: 'plus' | 'minus'; tint: string; ink: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, ...fill(tint), borderRadius: radius.lg, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={color.paper} weight={2.5} />
      </View>
      <T variant="bodyBold" color={color.ink} style={{ fontSize: 17 }}>
        {label}
      </T>
    </Pressable>
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
  const { owner } = useAccess();
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
        {owner && property && s.parties.length > 1 ? <Tag label={t(`Pour moi : ${money(s.mine, { sign: true })}`, `For me: ${money(s.mine, { sign: true })}`)} /> : null}
        {owner && managed && s.commission ? <Tag label={t(`dont ${money(s.commission)} de commission`, `incl. ${money(s.commission)} commission`)} /> : null}
        {s.setup ? <Tag label={t(`Hors mise en place : ${money(s.setup)}`, `Set-up costs aside: ${money(s.setup)}`)} /> : null}
      </View>
      {false && property && (s.rent > 0 || s.expenses > 0) ? (
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
  const { owner, isMe } = useAccess();
  const lines = [...s.parties].sort((a, b) => Number(b.party.is_me) - Number(a.party.is_me));
  const holder = lines.find((l) => l.party.is_me)?.party.name ?? '';
  const solo = lines.length <= 1 && !s.commission && !s.privateExpenses;

  return (
    <View>
      <SectionTitle action={owner ? <TextLink label={t('Règles', 'Rules')} onPress={() => router.push({ pathname: '/rules', params: { property: property.id } })} /> : undefined}>{t('Répartition', 'Split')}</SectionTitle>
      {!rule ? (
        <Notice text={t('Aucune règle de partage pour ce bien : tout est compté pour moi.', 'No sharing rule for this property yet: everything counts as mine.')} />
      ) : solo ? (
        <T color={color.inkSoft}>{owner ? t('Ce bien est à moi seule : le résultat du mois me revient en entier.', 'This place is mine alone: the whole result of the month is mine.') : t(`Le résultat du mois revient en entier à ${holder}.`, `The whole result of the month goes to ${holder}.`)}</T>
      ) : (
        <Block>
          {lines.map((line) => {
            const share = rule.shares.find((x) => x.party_id === line.party.id);
            const parts = [shareLabel(share, locale)].filter(Boolean);
            if (isMe(line.party) && line.commission) parts.push(t(`commission ${money(line.commission)}`, `commission ${money(line.commission)}`));
            return <Row key={line.party.id} title={isMe(line.party) ? t('Moi', 'Me') : line.party.name} subtitle={parts.join(', ') || undefined} value={money(line.net, { sign: true })} valueColor={line.net < 0 ? color.negative : color.ink} />;
          })}
          {s.privateExpenses ? <Row title={t('Mes frais privés', 'My private costs')} subtitle={t('Jamais visibles dans un relevé partagé', 'Never shown in a shared statement')} value={money(-s.privateExpenses)} leading={<Icon name="lock" size={16} color={color.inkSoft} />} /> : null}
          {s.privateExpenses ? <Row title={t('Pour moi ce mois-ci', 'For me this month')} value={money(s.mine, { sign: true })} valueColor={s.mine < 0 ? color.negative : color.positive} /> : null}
        </Block>
      )}
    </View>
  );
}

/** For a member who does not see the figures: what this space is for. */
function MemberIntro() {
  const t = useT();
  const { access, canEdit } = useAccess();
  const { property } = useSelection();
  return (
    <View style={{ gap: space.sm }}>
      <T variant="label" color={color.inkSoft}>
        {access?.ownerName ? t(`Partagé par ${access.ownerName}`, `Shared by ${access.ownerName}`) : t('Bien partagé', 'Shared property')}
      </T>
      <T variant="hero" numberOfLines={2}>
        {property?.name ?? ''}
      </T>
      <T color={color.inkSoft}>
        {canEdit
          ? t('Note ici ce qui entre et ce qui sort pour ce logement. Tout est enregistré directement dans ses comptes.', 'Record here what comes in and goes out for this place. Everything goes straight into its accounts.')
          : t('Tu peux consulter ce qui a été enregistré pour ce logement.', 'You can look at what was recorded for this place.')}
      </T>
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

/**
 * `/?add=expense` or `/?add=booking` opens the matching form: the shortcuts
 * offered by a long press on the installed app's icon land here.
 */
function useQuickAdd() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  useEffect(() => {
    if (add !== 'expense' && add !== 'booking') return;
    router.setParams({ add: undefined });
    router.push({ pathname: '/entry', params: { type: add } });
  }, [add]);
}
