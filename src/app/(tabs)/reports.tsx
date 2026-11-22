/**
 * Reports: the year at a glance (the Excel "Monthly_Dashboard", drawn),
 * where the money comes from and goes, and questions in plain language.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { occupancy, series, statement } from '@/core/calc';
import { currentMonth, monthsOfYear, yearOf } from '@/core/dates';
import { AiUnavailable } from '@/data/backend';
import { useData, useStore } from '@/data/store';
import { useAccess, useMoney, useSelection } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { categoryLabel, monthLabel, monthShort, useLocale, useT } from '@/i18n';
import { Bars, Breakdown, Legend, Ring, Tile, Tiles, Trend } from '@/ui/charts';
import { Button, Empty, Notice, Row, SectionTitle } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { Block, Card, Cols, Screen, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, platformColor, seriesColors, space } from '@/ui/theme';

export default function ReportsScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const wide = useWide();
  const data = useData();
  const { property } = useSelection();
  const month = useStore((s) => s.month);
  const { setMonth } = useStore.getState();
  const [year, setYear] = useState(yearOf(month));
  const { owner } = useAccess();

  const id = property?.id ?? null;
  const points = useMemo(() => series(data, id, monthsOfYear(year)), [data, id, year]);
  const total = useMemo(() => statement(data, id, (m) => yearOf(m) === year), [data, id, year]);
  const filled = points.filter((p) => p.revenue || p.expenses);
  // Occupancy over the months that have entries, so an unfinished year is not diluted.
  const occ = useMemo(() => occupancy(data, id, filled.map((p) => p.month)), [data, id, filled]);
  const sorted = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1]);
  const tints = seriesColors();
  const result = property ? total.net : total.mine;
  const openMonth = (m: string) => {
    setMonth(m);
    router.navigate('/');
  };

  return (
    <Screen>
      <PageHeader title={t(`Bilan ${year}`, `${year} report`)} stepper={{ onPrev: () => setYear(year - 1), onNext: () => setYear(year + 1), onReset: () => setYear(yearOf(currentMonth())) }} />

      {filled.length ? (
        <>
          <Tiles wide={wide}>
            {[
              <Tile key="res" label={property ? t('Résultat', 'Result') : t('Pour moi', 'For me')} value={money(result, { sign: true })} note={owner && property && total.parties.length > 1 ? t(`pour moi ${money(total.mine, { sign: true })}`, `for me ${money(total.mine, { sign: true })}`) : undefined} tint={result < 0 ? color.tintExpense : color.tintIncome} />,
              <Tile key="in" label={t('Revenus', 'Income')} value={money(total.revenue)} note={t(`${total.bookings.length} versements`, `${total.bookings.length} payouts`)} tint={color.tintIncome} />,
              <Tile key="out" label={t('Dépenses', 'Expenses')} value={money(total.expenses)} tint={color.tintExpense} />,
              <Tile key="occ" label={t('Occupation', 'Occupancy')} value={`${Math.round(occ.rate * 100)} %`} note={t(`${occ.booked} nuits louées`, `${occ.booked} nights booked`)} tint={color.tintOccupancy} aside={<Ring value={occ.rate} size={44} stroke={6} />} />,
            ]}
          </Tiles>
          {total.setup ? (
            <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
              {t(`Hors mise en place : ${money(total.setup)} payés par les apports de départ. La courbe du résultat cumulé, elle, les compte.`, `Set-up costs aside: ${money(total.setup)} paid out of the initial contributions. The running result does count them.`)}
            </T>
          ) : null}

          <Cols ratio={[3, 2]}>
            <View>
              <SectionTitle>{t('Revenus et dépenses', 'Income and expenses')}</SectionTitle>
              <Card>
                <Bars points={points.map((p) => ({ key: p.month, label: monthShort(p.month, locale).slice(0, wide ? 3 : 1), income: p.revenue, expenses: p.expenses }))} selected={month} onSelect={openMonth} height={150} />
                <View style={{ marginTop: space.md }}>
                  <Legend items={[{ label: t('Revenus', 'Income'), tint: color.chartIncome }, { label: t('Dépenses', 'Expenses'), tint: color.chartExpense }]} />
                </View>
              </Card>
            </View>
            <View>
              <SectionTitle>{property ? t('Résultat cumulé', 'Running result') : t('Ce que ça me rapporte, mois après mois', 'What it earns me, month after month')}</SectionTitle>
              <Card>
                <Trend values={filled.map((p) => (property ? p.cumulative : p.mine))} labels={[monthShort(filled[0].month, locale), monthShort(filled[filled.length - 1].month, locale)]} height={150} />
                <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
                  {property
                    ? t(`Depuis la première écriture du bien : ${money(filled[filled.length - 1].cumulative, { sign: true })}.`, `Since the property’s first entry: ${money(filled[filled.length - 1].cumulative, { sign: true })}.`)
                    : t('La ligne pointillée marque zéro.', 'The dotted line marks zero.')}
                </T>
              </Card>
            </View>
          </Cols>

          <Cols ratio={[3, 2]}>
            <View>
              <SectionTitle>{t('Mois par mois', 'Month by month')}</SectionTitle>
              <Block>
                {filled.map((p, i) => (
                  <Row
                    key={p.month}
                    title={monthLabel(p.month, locale).split(' ')[0]}
                    subtitle={[t(`Revenus ${money(p.revenue)}`, `Income ${money(p.revenue)}`), t(`dépenses ${money(p.expenses)}`, `expenses ${money(p.expenses)}`), p.rentCovered === null ? null : p.rentCovered ? t('loyer couvert', 'rent covered') : t('loyer non couvert', 'rent not covered')].filter(Boolean).join(', ')}
                    value={money(property ? p.net : p.mine, { sign: true })}
                    valueColor={(property ? p.net : p.mine) < 0 ? color.negative : color.positive}
                    note={t(`${p.nights} nuits`, `${p.nights} nights`)}
                    onPress={() => openMonth(p.month)}
                    last={i === filled.length - 1}
                  />
                ))}
              </Block>
            </View>
            <View>
              {total.revenue ? (
                <>
                  <SectionTitle>{t('D’où viennent les revenus', 'Where income comes from')}</SectionTitle>
                  <Breakdown items={sorted(total.byPlatform).map(([label, value]) => ({ label, value, tint: platformColor(label) }))} format={money} />
                </>
              ) : null}
              {total.expenses ? (
                <>
                  <SectionTitle>{t('Où part l’argent', 'Where the money goes')}</SectionTitle>
                  <Breakdown items={sorted(total.byCategory).map(([key, value], i) => ({ label: categoryLabel(key, locale), value, tint: tints[i % tints.length] }))} format={money} />
                </>
              ) : null}
            </View>
          </Cols>

          <View style={{ maxWidth: 720 }}>
            {owner ? <Ask year={year} /> : null}
          </View>
        </>
      ) : (
        <Empty title={t(`Rien d’enregistré en ${year}`, `Nothing recorded in ${year}`)} text={t('Change d’année avec les flèches, ou ajoute une première écriture.', 'Switch year with the arrows, or add a first entry.')} />
      )}
    </Screen>
  );
}

/** Free-form questions about the figures of the year on screen. */
function Ask({ year }: { year: number }) {
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const backend = useStore((s) => s.backend);
  const { property } = useSelection();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    setBusy(true);
    setAnswer(null);
    setUnavailable(null);
    // Only totals leave the device: no names of guests, no receipts.
    const scope = data.properties.filter((p) => !p.archived && (!property || p.id === property.id));
    const context = {
      currency: data.profile.currency,
      year,
      language: locale,
      properties: scope.map((p) => ({
        name: p.name,
        arrangement: p.kind,
        months: series(data, p.id, monthsOfYear(year))
          .filter((m) => m.revenue || m.expenses)
          .map((m) => {
            const s = statement(data, p.id, (x) => x === m.month);
            return { month: m.month, income: Math.round(m.revenue), expenses: Math.round(m.expenses), nights: m.nights, rent_covered: m.rentCovered, for_me: Math.round(m.mine), by_platform: s.byPlatform, by_category: s.byCategory };
          }),
      })),
    };
    try {
      setAnswer(await backend.ask(text, context));
    } catch (e) {
      setUnavailable(
        e instanceof AiUnavailable && e.reason === 'quota'
          ? t('Limite de questions atteinte pour aujourd’hui.', 'Daily question limit reached.')
          : e instanceof AiUnavailable
            ? t('L’assistant n’est pas encore activé sur ce compte. Tout le reste fonctionne sans lui.', 'The assistant is not enabled on this account yet. Everything else works without it.')
            : t('Pas de réponse pour l’instant. Réessaie dans un moment.', 'No answer right now. Try again in a moment.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const ideas = [t('Résume mon année en trois phrases.', 'Sum up my year in three sentences.'), t('Quel mois a été le plus rentable, et pourquoi ?', 'Which month was the most profitable, and why?'), t('Quelles dépenses pourrais-je réduire ?', 'Which expenses could I cut?')];
  return (
    <>
      <SectionTitle>{t('Poser une question', 'Ask a question')}</SectionTitle>
      <View style={{ gap: space.sm }}>
        <Field label={t(`Sur les chiffres de ${year}`, `About the ${year} figures`)} value={question} onChangeText={setQuestion} placeholder={ideas[1]} onSubmitEditing={() => question.trim() && void ask(question)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button compact tone="dark" icon="spark" label={t('Demander', 'Ask')} onPress={() => void ask(question.trim() || ideas[0])} busy={busy} />
          <Button compact tone="quiet" label={t('Résumer l’année', 'Sum up the year')} onPress={() => void ask(ideas[0])} disabled={busy} />
        </View>
        {answer ? (
          <View style={{ flexDirection: 'row', gap: space.md, backgroundColor: color.sunken, borderRadius: 16, padding: space.lg }}>
            <Icon name="spark" size={18} color={color.inkSoft} />
            <T style={{ flex: 1 }}>{answer}</T>
          </View>
        ) : null}
        {unavailable ? <Notice text={unavailable} /> : null}
        <T variant="small" color={color.inkSoft}>
          {t('Seuls les totaux mensuels sont envoyés à l’assistant, jamais tes reçus ni le nom de tes voyageurs.', 'Only monthly totals are sent to the assistant, never your receipts or your guests’ names.')}
        </T>
      </View>
    </>
  );
}
