/**
 * An invoice or receipt as a thing of its own: it can stand alone, or be
 * linked to an expense (and unlinked again) at any time.
 *
 * Opened with ?id=… to edit a stored one, or ?new=1 right after a photo or a
 * file was picked (the file waits in `pendingFile`).
 */
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { base } from '@/core/calc';
import { today } from '@/core/dates';
import { evalAmount } from '@/core/money';
import type { Doc, Expense } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useAccess, useMoney, usePropertyChoice } from '@/features/hooks';
import { peekPendingFile, setPendingFile } from '@/features/pendingFile';
import { categoryLabel, dayLabel, useLocale, useT } from '@/i18n';
import type { PickedFile } from '@/platform/pick';
import { Button, Choice, ConfirmButton, Row, TextLink } from '@/ui/controls';
import { AmountField, DateFields, Field, Label } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { Block, FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, radius, space } from '@/ui/theme';

export default function InvoiceScreen() {
  const params = useLocalSearchParams<{ id?: string; new?: string }>();
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const { save, addDoc, removeDoc } = useStore.getState();
  const { owner, canEdit } = useAccess();
  const existing = params.id ? data.docs.find((d) => d.id === params.id) : undefined;
  const [file] = useState<PickedFile | null>(() => (params.new === '1' ? peekPendingFile() : null));
  useEffect(() => () => setPendingFile(null), []);

  const { propertyId, setPropertyId, options } = usePropertyChoice(existing ? existing.property_id : undefined, owner);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : '');
  const [expenseId, setExpenseId] = useState<string | null>(existing?.expense_id ?? null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const linked = expenseId ? data.expenses.find((x) => x.id === expenseId) : undefined;
  const value = evalAmount(amount);

  async function submit() {
    setBusy(true);
    const fields = {
      property_id: linked ? linked.property_id : propertyId,
      expense_id: expenseId,
      title: title.trim(),
      date,
      amount: value !== null && value > 0 ? value : null,
    };
    try {
      if (existing) await save('docs', { ...existing, ...fields } satisfies Doc);
      else if (file) await addDoc(file, fields);
      router.back();
    } catch {
      setBusy(false);
    }
  }

  if (!existing && !file) {
    return (
      <FormScreen title={t('Facture', 'Invoice')}>
        <T color={color.inkSoft}>{t('Cette facture n’existe plus.', 'This invoice no longer exists.')}</T>
      </FormScreen>
    );
  }

  if (!canEdit) {
    // A view-only member link: the invoice and its details, nothing to change.
    return (
      <FormScreen title={t('Facture', 'Invoice')}>
        <Preview doc={existing} file={null} />
        {existing?.title ? <T variant="heading">{existing.title}</T> : null}
        <T color={color.inkSoft}>
          {[existing?.date ? dayLabel(existing.date, locale) + ' ' + existing.date.slice(0, 4) : null, existing?.amount ? money(existing.amount) : null].filter(Boolean).join(', ')}
        </T>
        {linked ? (
          <View>
            <Label>{t('Dépense liée', 'Linked expense')}</Label>
            <Block>
              <Row title={linked.description || linked.vendor || categoryLabel(linked.category, locale)} subtitle={[categoryLabel(linked.category, locale), dayLabel(linked.date, locale)].join(', ')} value={money(-base(linked))} onPress={() => router.push({ pathname: '/entry', params: { type: 'expense', id: linked.id } })} last />
            </Block>
          </View>
        ) : null}
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={existing ? t('Facture', 'Invoice') : t('Nouvelle facture', 'New invoice')}
      footer={<Button label={t('Enregistrer', 'Save')} onPress={() => void submit()} busy={busy} />}>
      <Preview doc={existing} file={file} />

      <Field label={t('Ce que c’est', 'What it is')} value={title} onChangeText={setTitle} placeholder={t('Facture Senelec, devis plombier…', 'Power bill, plumber quote…')} />

      {linked ? null : (
        <View>
          <Label>{t('Bien', 'Property')}</Label>
          <Choice value={propertyId} onChange={setPropertyId} options={options} />
        </View>
      )}

      <DateFields items={[{ label: t('Date de la facture', 'Invoice date'), value: date, onChange: (d) => d && setDate(d) }]} />
      <View style={{ gap: space.xs }}>
        <AmountField label={t('Montant (facultatif)', 'Amount (optional)')} value={amount} onChangeText={setAmount} currency={data.profile.currency} />
        <T variant="small" color={color.inkSoft}>
          {t('Pour mémoire : seules les dépenses comptent dans les calculs.', 'For reference: only expenses count in the figures.')}
        </T>
      </View>

      <View>
        <Label>{t('Dépense liée', 'Linked expense')}</Label>
        {linked ? (
          <Block>
            <Row
              title={linked.description || linked.vendor || categoryLabel(linked.category, locale)}
              subtitle={[categoryLabel(linked.category, locale), dayLabel(linked.date, locale)].join(', ')}
              value={money(-base(linked))}
              onPress={() => router.push({ pathname: '/entry', params: { type: 'expense', id: linked.id } })}
              last
            />
            <View style={{ flexDirection: 'row', gap: space.lg, paddingBottom: space.sm }}>
              <TextLink label={t('Changer', 'Change')} onPress={() => setChoosing(true)} />
              <TextLink label={t('Détacher', 'Unlink')} tint={color.negative} onPress={() => setExpenseId(null)} />
            </View>
          </Block>
        ) : choosing ? null : (
          <View style={{ gap: space.sm }}>
            <T variant="small" color={color.inkSoft}>
              {t('Aucune : la facture reste rangée seule. Tu pourras la rattacher plus tard.', 'None: the invoice is filed on its own. You can link it later.')}
            </T>
            <Button compact tone="quiet" icon="link" label={t('Rattacher à une dépense', 'Link to an expense')} onPress={() => setChoosing(true)} />
          </View>
        )}
        {choosing ? (
          <ExpensePicker
            propertyId={linked ? linked.property_id : propertyId}
            amount={value}
            date={date}
            onPick={(x) => {
              setExpenseId(x.id);
              setChoosing(false);
            }}
            onCancel={() => setChoosing(false)}
          />
        ) : null}
      </View>

      {existing && owner ? (
        <ConfirmButton
          label={t('Supprimer cette facture', 'Delete this invoice')}
          confirmLabel={t('Confirmer la suppression', 'Confirm deletion')}
          onConfirm={() => void removeDoc(existing).then(() => router.back())}
        />
      ) : null}
    </FormScreen>
  );
}

/** The picture, or a line for a PDF, with a button to open it full size. */
function Preview({ doc, file }: { doc?: Doc; file: PickedFile | null }) {
  const t = useT();
  const backend = useStore((s) => s.backend);
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

  const mime = doc?.mime ?? file?.mime ?? '';
  const source = file?.base64 ? `data:${file.mime};base64,${file.base64}` : mime.startsWith('image/') && url ? url : null;
  return (
    <View style={{ gap: space.sm }}>
      {source ? (
        <Image source={{ uri: source }} style={{ width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: color.sunken }} contentFit="contain" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: space.md }}>
          <Icon name="file" color={color.inkSoft} />
          <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {doc?.name || file?.name || t('Justificatif', 'Receipt')}
          </T>
        </View>
      )}
      {url ? <TextLink label={mime === 'application/pdf' ? t('Ouvrir le PDF', 'Open the PDF') : t('Ouvrir en grand', 'Open full size')} onPress={() => void Linking.openURL(url)} /> : null}
    </View>
  );
}

/**
 * Expenses to link to, most likely first: same amount, then closest date.
 * A search box narrows the list.
 */
function ExpensePicker({ propertyId, amount, date, onPick, onCancel }: { propertyId: string | null; amount: number | null; date: string; onPick: (x: Expense) => void; onCancel: () => void }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const day = (d: string) => new Date(d).getTime() / 86_400_000;
    return data.expenses
      .filter((x) => !x.excluded && (propertyId === null || x.property_id === propertyId))
      .filter((x) => !q || [x.description, x.vendor, categoryLabel(x.category, locale), String(Math.round(base(x)))].some((s) => s.toLowerCase().includes(q)))
      .map((x) => ({ x, score: (amount && Math.abs(base(x) - amount) < 1 ? 0 : 1000) + Math.abs(day(x.date) - day(date)) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 30)
      .map((r) => r.x);
  }, [data.expenses, propertyId, query, amount, date, locale]);
  return (
    <View style={{ gap: space.sm, marginTop: space.sm }}>
      <Field label={t('Chercher une dépense', 'Find an expense')} value={query} onChangeText={setQuery} placeholder={t('Senelec, ménage, 22000…', 'Power, cleaning, 22000…')} />
      <Block>
        {list.length ? (
          list.map((x, i) => (
            <Row
              key={x.id}
              title={x.description || x.vendor || categoryLabel(x.category, locale)}
              subtitle={[categoryLabel(x.category, locale), dayLabel(x.date, locale) + ' ' + x.date.slice(0, 4)].join(', ')}
              value={money(-base(x))}
              onPress={() => onPick(x)}
              last={i === list.length - 1}
            />
          ))
        ) : (
          <T color={color.inkSoft} style={{ paddingVertical: space.md }}>
            {t('Aucune dépense trouvée.', 'No expense found.')}
          </T>
        )}
      </Block>
      <TextLink label={t('Annuler', 'Cancel')} onPress={onCancel} />
    </View>
  );
}
