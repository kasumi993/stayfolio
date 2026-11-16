/** Receipts and invoices, all in one place, each linked to its expense. */
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { base } from '@/core/calc';
import type { Doc } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useMoney, useSelection } from '@/features/hooks';
import { setPendingFile } from '@/features/pendingFile';
import { categoryLabel, dayLabel, monthLabel, useLocale, useT } from '@/i18n';
import { type PickedFile, pickDocument, takePhoto } from '@/platform/pick';
import { Button, Choice, ConfirmButton, Empty, Row, SectionTitle } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Block, Screen, Sheet } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export default function DocumentsScreen() {
  const params = useLocalSearchParams<{ open?: string }>();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const { property } = useSelection();
  const [filter, setFilter] = useState<'all' | 'missing'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  // Arriving with ?open=… (from an expense) opens that file straight away.
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (params.open !== seenParam) {
    setSeenParam(params.open);
    if (params.open) setOpenId(params.open);
  }
  const open = data.docs.find((d) => d.id === openId) ?? null;
  const setOpen = (doc: Doc | null) => setOpenId(doc?.id ?? null);

  const expenseOf = useMemo(() => new Map(data.expenses.map((x) => [x.id, x])), [data.expenses]);
  const docs = data.docs.filter((d) => !property || d.property_id === property.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const withDoc = new Set(data.docs.map((d) => d.expense_id));
  const missing = data.expenses
    .filter((x) => !x.excluded && !x.recurring_id && !withDoc.has(x.id) && (!property || x.property_id === property.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);
  const groups = [...new Set(docs.map((d) => d.created_at.slice(0, 7)))];

  async function add(pick: () => Promise<PickedFile | null>) {
    try {
      const file = await pick();
      if (!file) return;
      setPendingFile(file);
      router.push({ pathname: '/entry', params: { type: 'expense', scan: '1' } });
    } catch {
      useStore.setState({ error: t('Accès à l’appareil photo refusé. Autorise-le dans les réglages.', 'Camera access was refused. Allow it in Settings.') });
    }
  }

  return (
    <Screen>
      <T variant="title" style={{ marginTop: space.md }}>
        {t('Reçus et factures', 'Receipts and invoices')}
      </T>
      <T color={color.inkSoft} style={{ marginTop: space.xs }}>
        {property ? property.name : t('Tous les biens', 'All properties')}
      </T>
      <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.lg }}>
        <Button compact icon="camera" label={t('Photographier', 'Take a photo')} onPress={() => void add(takePhoto)} style={{ flex: 1 }} />
        <Button compact tone="quiet" icon="file" label={t('Joindre un fichier', 'Attach a file')} onPress={() => void add(pickDocument)} style={{ flex: 1 }} />
      </View>
      <Choice
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t(`Rangés (${docs.length})`, `Filed (${docs.length})`) },
          { value: 'missing', label: t('Dépenses sans reçu', 'Expenses without a receipt') },
        ]}
      />

      {filter === 'all' ? (
        docs.length ? (
          groups.map((g) => (
            <View key={g}>
              <SectionTitle>{monthLabel(g, locale)}</SectionTitle>
              <Block>
                {docs
                  .filter((d) => d.created_at.startsWith(g))
                  .map((d, i, list) => {
                    const x = d.expense_id ? expenseOf.get(d.expense_id) : undefined;
                    return (
                      <Row
                        key={d.id}
                        title={x ? x.description || x.vendor || categoryLabel(x.category, locale) : d.name || t('Justificatif', 'Receipt')}
                        subtitle={x ? [categoryLabel(x.category, locale), dayLabel(x.date, locale)].join(', ') : t('Pas encore rattaché à une dépense', 'Not linked to an expense yet')}
                        value={x ? money(-base(x)) : undefined}
                        leading={<Icon name={d.mime === 'application/pdf' ? 'file' : 'image'} size={20} color={color.inkSoft} />}
                        onPress={() => setOpen(d)}
                        last={i === list.length - 1}
                      />
                    );
                  })}
              </Block>
            </View>
          ))
        ) : (
          <Empty title={t('Aucun reçu rangé', 'No receipt filed yet')} text={t('Photographie un ticket : il est rangé avec sa dépense, et tu le retrouves ici.', 'Photograph a receipt: it is filed with its expense, and you find it here.')} />
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
        <Empty title={t('Tout est justifié', 'Everything has a receipt')} text={t('Chaque dépense a son reçu.', 'Every expense has its receipt.')} />
      )}

      <Viewer doc={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/** Shows one stored file. Links are temporary and created on demand. */
function Viewer({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const t = useT();
  const backend = useStore((s) => s.backend);
  const removeDoc = useStore((s) => s.removeDoc);
  // The link is remembered with the path it belongs to, so a stale one is never shown.
  const [link, setLink] = useState<{ path: string; url: string } | null>(null);
  const path = doc?.path;
  const url = link && link.path === path ? link.url : null;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    backend
      .fileUrl(path)
      .then((found) => !cancelled && setLink({ path, url: found }))
      .catch(() => !cancelled && setLink({ path, url: '' }));
    return () => {
      cancelled = true;
    };
  }, [path, backend]);

  return (
    <Sheet open={!!doc} onClose={onClose} title={doc?.name || t('Justificatif', 'Receipt')}>
      {doc ? (
        <View style={{ gap: space.md }}>
          {doc.mime.startsWith('image/') && url ? (
            <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 0.75, borderRadius: radius.lg, backgroundColor: color.line }} contentFit="contain" />
          ) : url === null ? (
            <T color={color.inkSoft}>{t('Chargement…', 'Loading…')}</T>
          ) : null}
          {url ? <Button tone="dark" label={doc.mime === 'application/pdf' ? t('Ouvrir le PDF', 'Open the PDF') : t('Ouvrir en grand', 'Open full size')} onPress={() => void Linking.openURL(url)} /> : null}
          {doc.expense_id ? (
            <Button
              tone="quiet"
              label={t('Voir la dépense', 'See the expense')}
              onPress={() => {
                onClose();
                router.push({ pathname: '/entry', params: { type: 'expense', id: doc.expense_id! } });
              }}
            />
          ) : null}
          <ConfirmButton label={t('Supprimer ce fichier', 'Delete this file')} confirmLabel={t('Confirmer la suppression', 'Confirm deletion')} onConfirm={() => void removeDoc(doc).then(onClose)} />
        </View>
      ) : null}
    </Sheet>
  );
}
