/**
 * Entries: every income and expense of the month, newest day first, with the
 * buttons to add one. A filter shows only income or only expenses.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { base, monthStatement } from '@/core/calc';
import { addMonths, currentMonth } from '@/core/dates';
import type { Booking, Expense } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { BookingRow, ExpenseRow } from '@/features/EntryRows';
import { useAccess, useMoney, useSelection } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { dayLabel, monthLabel, useLocale, useT } from '@/i18n';
import { Button, Choice, Empty, SectionTitle } from '@/ui/controls';
import { Field } from '@/ui/fields';
import { Block, Screen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, space } from '@/ui/theme';

type Line = { kind: 'booking'; row: Booking; day: string } | { kind: 'expense'; row: Expense; day: string };

export default function EntriesScreen() {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const month = useStore((s) => s.month);
  const setMonth = useStore((s) => s.setMonth);
  const { property } = useSelection();
  const id = property?.id ?? null;
  const { canEdit, sees } = useAccess();
  const both = sees('income') && sees('expenses');
  const [picked, setShow] = useState<'all' | 'income' | 'expenses'>('all');
  // A member who sees only one kind gets only that kind.
  const show = both ? picked : sees('income') ? 'income' : 'expenses';
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(data.properties.map((p) => [p.id, p])), [data.properties]);
  const s = useMemo(() => monthStatement(data, id, month), [data, id, month]);

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (...fields: (string | null | undefined)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));
    const all: Line[] = [
      ...(show === 'expenses' ? [] : s.bookings.filter((b) => match(b.platform, b.guest, b.notes, String(Math.round(base(b))))).map((b) => ({ kind: 'booking' as const, row: b, day: b.check_in }))),
      ...(show === 'income' ? [] : s.expenseRows.filter((x) => match(x.description, x.vendor, x.category, String(Math.round(base(x))))).map((x) => ({ kind: 'expense' as const, row: x, day: x.date }))),
    ];
    return all.sort((a, b) => b.day.localeCompare(a.day) || (a.kind === b.kind ? 0 : a.kind === 'booking' ? -1 : 1));
  }, [s, show, query]);
  const days = [...new Set(lines.map((l) => l.day))];

  return (
    <Screen reading>
      <PageHeader
        title={t('Saisies', 'Entries')}
        subtitle={monthLabel(month, locale)}
        stepper={{ onPrev: () => setMonth(addMonths(month, -1)), onNext: () => setMonth(addMonths(month, 1)), onReset: () => setMonth(currentMonth()) }}
      />
      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
          {sees('expenses') ? <Button icon="minus" label={t('Dépense', 'Expense')} onPress={() => router.push({ pathname: '/entry', params: { type: 'expense' } })} style={{ flex: 1 }} /> : null}
          {sees('income') ? <Button tone={sees('expenses') ? 'quiet' : 'primary'} icon="plus" label={t('Revenu', 'Income')} onPress={() => router.push({ pathname: '/entry', params: { type: 'booking' } })} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
      {both ? <Choice
        value={show}
        onChange={setShow}
        options={[
          { value: 'all', label: t('Tout', 'All') },
          { value: 'income', label: t(`Revenus · ${money(s.revenue)}`, `Income · ${money(s.revenue)}`) },
          { value: 'expenses', label: t(`Dépenses · ${money(s.expenses)}`, `Expenses · ${money(s.expenses)}`) },
        ]}
      /> : null}
      <View style={{ marginTop: both ? space.md : 0 }}>
        <Field label={t('Chercher', 'Search')} value={query} onChangeText={setQuery} placeholder={t('Airbnb, ménage, Senelec…', 'Airbnb, cleaning, power…')} />
      </View>

      {lines.length ? (
        days.map((day) => {
          const ofDay = lines.filter((l) => l.day === day);
          return (
            <View key={day}>
              <SectionTitle>{dayLabel(day, locale)}</SectionTitle>
              <Block>
                {ofDay.map((l, i) =>
                  l.kind === 'booking' ? (
                    <BookingRow key={l.row.id} booking={l.row} property={property ? undefined : byId.get(l.row.property_id)} last={i === ofDay.length - 1} />
                  ) : (
                    <ExpenseRow key={l.row.id} expense={l.row} property={property ? undefined : l.row.property_id ? byId.get(l.row.property_id) : undefined} last={i === ofDay.length - 1} />
                  ),
                )}
              </Block>
            </View>
          );
        })
      ) : query ? (
        <T color={color.inkSoft} style={{ marginTop: space.xl }}>
          {t('Rien ne correspond à cette recherche ce mois-ci.', 'Nothing matches this search this month.')}
        </T>
      ) : (
        <Empty
          title={show === 'income' ? t('Aucun revenu ce mois-ci', 'No income this month') : show === 'expenses' ? t('Aucune dépense ce mois-ci', 'No expenses this month') : t('Rien ce mois-ci', 'Nothing this month')}
          text={t('Ajoute-les avec les boutons ci-dessus.', 'Add them with the buttons above.')}
        />
      )}
    </Screen>
  );
}
