/**
 * Reports: the year at a glance (the Excel "Monthly_Dashboard", drawn),
 * where the money comes from and goes, and questions in plain language.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { series, statement } from '@/core/calc';
import { currentMonth, monthsOfYear, yearOf } from '@/core/dates';
import { AiUnavailable } from '@/data/backend';
import { useData, useStore } from '@/data/store';
import { Hero, HeroFacts, Stepper } from '@/features/Hero';
import { useMoney, useSelection } from '@/features/hooks';
import { categoryLabel, monthLabel, monthShort, useLocale, useT } from '@/i18n';
import { Breakdown, Legend, YearBars } from '@/ui/charts';
import { Button, Notice, Row, SectionTitle } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { Block, Screen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, platformColor, space } from '@/ui/theme';

export default function ReportsScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const { property } = useSelection();
  const month = useStore((s) => s.month);
  const { setMonth } = useStore.getState();
  const [year, setYear] = useState(yearOf(month));

  const id = property?.id ?? null;
  const points = useMemo(() => series(data, id, monthsOfYear(year)), [data, id, year]);
  const total = useMemo(() => statement(data, id, (m) => yearOf(m) === year), [data, id, year]);
  const filled = points.filter((p) => p.revenue || p.expenses);
  const last = filled[filled.length - 1];
  const sorted = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1]);

  return (
    <Screen
      header={
        <Hero>
          <Stepper label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} onLabelPress={() => setYear(yearOf(currentMonth()))} />
          <T variant="title" color={color.onHero} style={{ marginTop: space.md, minHeight: 64 }}>
            {!filled.length
              ? t(`Rien d’enregistré en ${year}.`, `Nothing recorded in ${year}.`)
              : property
                ? total.net >= 0
                  ? t(`${year} : ${money(total.net)} de résultat.`, `${year}: ${money(total.net)} in profit.`)
                  : t(`${year} : ${money(-total.net)} restent à récupérer.`, `${year}: ${money(-total.net)} still to recover.`)
                : total.mine >= 0
                  ? t(`${year} me rapporte ${money(total.mine)}.`, `${year} earns me ${money(total.mine)}.`)
                  : t(`${year} me coûte ${money(-total.mine)}.`, `${year} costs me ${money(-total.mine)}.`)}
          </T>
          <HeroFacts
            facts={[
              { label: t('Revenus', 'Income'), value: money(total.revenue) },
              { label: t('Dépenses', 'Expenses'), value: money(total.expenses) },
              { label: t('Nuits', 'Nights'), value: String(total.nights) },
            ]}
          />
        </Hero>
      }>
      {filled.length ? (
        <>
          <View style={{ marginTop: space.lg, gap: space.md }}>
            <YearBars
              points={points.map((p) => ({ key: p.month, label: monthShort(p.month, locale), revenue: p.revenue, expenses: p.expenses }))}
              selected={month}
              onSelect={(m) => {
                setMonth(m);
                router.navigate('/');
              }}
            />
            <Legend items={[{ label: t('Revenus', 'Income'), tint: color.chartIncome }, { label: t('Dépenses', 'Expenses'), tint: color.chartExpense }]} />
          </View>

          <SectionTitle>{t('Mois par mois', 'Month by month')}</SectionTitle>
          <Block>
            {filled.map((p, i) => (
              <Row
                key={p.month}
                title={monthLabel(p.month, locale).split(' ')[0]}
                subtitle={[t(`${p.nights} nuits`, `${p.nights} nights`), p.rentCovered === null ? null : p.rentCovered ? t('loyer couvert', 'rent covered') : t('loyer non couvert', 'rent not covered')].filter(Boolean).join(', ')}
                value={money(property ? p.net : p.mine, { sign: true })}
                valueColor={(property ? p.net : p.mine) < 0 ? color.negative : color.positive}
                note={property ? t(`cumul ${money(p.cumulative, { sign: true })}`, `running ${money(p.cumulative, { sign: true })}`) : undefined}
                onPress={() => {
                  setMonth(p.month);
                  router.navigate('/');
                }}
                last={i === filled.length - 1}
              />
            ))}
          </Block>
          {property && last ? (
            <T variant="small" color={color.inkSoft} style={{ marginTop: space.sm }}>
              {t('Le cumul part de la toute première écriture du bien, comme dans le tableau de bord Excel.', 'The running total starts from the property’s very first entry, as in the Excel dashboard.')}
            </T>
          ) : null}

          {total.revenue ? (
            <>
              <SectionTitle>{t('D’où viennent les revenus', 'Where income comes from')}</SectionTitle>
              <Breakdown items={sorted(total.byPlatform).map(([label, value]) => ({ label, value, tint: platformColor(label) }))} format={money} />
            </>
          ) : null}
          {total.expenses ? (
            <>
              <SectionTitle>{t('Où part l’argent', 'Where the money goes')}</SectionTitle>
              <Breakdown items={sorted(total.byCategory).map(([key, value]) => ({ label: categoryLabel(key, locale), value }))} format={money} />
            </>
          ) : null}

          <Ask year={year} />
        </>
      ) : (
        <T color={color.inkSoft} style={{ marginTop: space.xl }}>
          {t('Change d’année avec les flèches, ou ajoute une première écriture avec le bouton +.', 'Switch year with the arrows, or add a first entry with the + button.')}
        </T>
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
          <View style={{ flexDirection: 'row', gap: space.md, backgroundColor: color.surface, borderRadius: 18, padding: space.lg }}>
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
