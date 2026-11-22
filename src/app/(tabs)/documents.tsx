/** Invoices and receipts: on their own, or linked to their expense. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { base } from '@/core/calc';
import type { Doc } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useAccess, useMoney, useSelection } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { setPendingFile } from '@/features/pendingFile';
import { categoryLabel, dayLabel, monthLabel, useLocale, useT } from '@/i18n';
import { type PickedFile, pickDocument, takePhoto } from '@/platform/pick';
import { Button, Choice, Empty, Row, SectionTitle } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block, Screen } from '@/ui/layout';
import { color, space } from '@/ui/theme';

export default function DocumentsScreen() {
  const params = useLocalSearchParams<{ open?: string }>();
  const t = useT();
  const { canEdit } = useAccess();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const { property } = useSelection();
  const [filter, setFilter] = useState<'all' | 'missing'>('all');
  // Arriving with ?open=… (older links) opens that invoice.
  useEffect(() => {
    if (params.open) router.replace({ pathname: '/invoice', params: { id: params.open } });
  }, [params.open]);

  const expenseOf = useMemo(() => new Map(data.expenses.map((x) => [x.id, x])), [data.expenses]);
  const docs = data.docs
    .filter((d) => !property || d.property_id === property.id)
    .sort((a, b) => (b.date ?? b.created_at).localeCompare(a.date ?? a.created_at));
  const loose = docs.filter((d) => !d.expense_id || !expenseOf.has(d.expense_id));
  const filed = docs.filter((d) => d.expense_id && expenseOf.has(d.expense_id));
  const withDoc = new Set(data.docs.map((d) => d.expense_id));
  const missing = data.expenses
    .filter((x) => !x.excluded && !x.recurring_id && !withDoc.has(x.id) && (!property || x.property_id === property.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);
  const monthOfDoc = (d: Doc) => {
    const x = d.expense_id ? expenseOf.get(d.expense_id) : undefined;
    return (x?.date ?? d.date ?? d.created_at).slice(0, 7);
  };
  const groups = [...new Set(filed.map(monthOfDoc))].sort().reverse();

  async function add(pick: () => Promise<PickedFile | null>) {
    try {
      const file = await pick();
      if (!file) return;
      setPendingFile(file);
      router.push({ pathname: '/invoice', params: { new: '1' } });
    } catch {
      useStore.setState({ error: t('Accès à l’appareil photo refusé. Autorise-le dans les réglages.', 'Camera access was refused. Allow it in Settings.') });
    }
  }
  const openDoc = (d: Doc) => router.push({ pathname: '/invoice', params: { id: d.id } });

  return (
    <Screen reading>
      <PageHeader title={t('Factures', 'Invoices')} subtitle={property ? property.name : t('Tous les biens', 'All properties')} />
      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
          <Button compact icon="camera" label={t('Photographier', 'Take a photo')} onPress={() => void add(takePhoto)} style={{ flex: 1 }} />
          <Button compact tone="quiet" icon="file" label={t('Ajouter un fichier', 'Add a file')} onPress={() => void add(pickDocument)} style={{ flex: 1 }} />
        </View>
      ) : null}
      <Choice
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t(`Factures (${docs.length})`, `Invoices (${docs.length})`) },
          { value: 'missing', label: t('Dépenses sans facture', 'Expenses without an invoice') },
        ]}
      />

      {filter === 'all' ? (
        docs.length ? (
          <>
            {loose.length ? (
              <View>
                <SectionTitle>{t('Seules, à rattacher si besoin', 'On their own, to link if needed')}</SectionTitle>
                <Block>
                  {loose.map((d, i) => (
                    <Row
                      key={d.id}
                      title={d.title || d.name || t('Facture', 'Invoice')}
                      subtitle={[d.date ? dayLabel(d.date, locale) + ' ' + d.date.slice(0, 4) : null, data.properties.find((p) => p.id === d.property_id)?.name].filter(Boolean).join(', ') || undefined}
                      value={d.amount ? money(-d.amount) : undefined}
                      valueColor={color.inkSoft}
                      leading={<Icon name={d.mime === 'application/pdf' ? 'file' : 'image'} size={20} color={color.inkSoft} />}
                      onPress={() => openDoc(d)}
                      last={i === loose.length - 1}
                    />
                  ))}
                </Block>
              </View>
            ) : null}
            {groups.map((g) => (
              <View key={g}>
                <SectionTitle>{monthLabel(g, locale)}</SectionTitle>
                <Block>
                  {filed
                    .filter((d) => monthOfDoc(d) === g)
                    .map((d, i, list) => {
                      const x = expenseOf.get(d.expense_id!)!;
                      return (
                        <Row
                          key={d.id}
                          title={d.title || x.description || x.vendor || categoryLabel(x.category, locale)}
                          subtitle={[categoryLabel(x.category, locale), dayLabel(x.date, locale)].join(', ')}
                          value={money(-base(x))}
                          leading={<Icon name={d.mime === 'application/pdf' ? 'file' : 'image'} size={20} color={color.inkSoft} />}
                          onPress={() => openDoc(d)}
                          last={i === list.length - 1}
                        />
                      );
                    })}
                </Block>
              </View>
            ))}
          </>
        ) : (
          <Empty title={t('Range ta première facture', 'File your first invoice')} text={t('Photographie un ticket ou ajoute un PDF. Il peut rester seul ou être rattaché à une dépense.', 'Take a photo of a receipt or add a PDF. It can stay on its own or be linked to an expense.')} />
        )
      ) : missing.length ? (
        <View style={{ marginTop: space.md }}>
          <Block>
            {missing.map((x, i) => (
              <Row
                key={x.id}
                title={x.description || x.vendor || categoryLabel(x.category, locale)}
                subtitle={[categoryLabel(x.category, locale), dayLabel(x.date, locale) + ' ' + x.date.slice(0, 4)].join(', ')}
                value={money(-base(x))}
                onPress={() => router.push({ pathname: '/entry', params: { type: 'expense', id: x.id } })}
                last={i === missing.length - 1}
              />
            ))}
          </Block>
        </View>
      ) : (
        <Empty title={t('Tout est justifié', 'Everything has an invoice')} text={t('Chaque dépense a sa facture.', 'Every expense has its invoice.')} />
      )}
    </Screen>
  );
}
