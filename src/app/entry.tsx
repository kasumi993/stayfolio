/**
 * Add or edit an expense or an income (booking payout).
 * Opened with ?type=expense|booking, and ?id=… to edit an existing row.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ruleFor } from '@/core/calc';
import { diffDays, monthOf, today } from '@/core/dates';
import { newId, now } from '@/core/id';
import { evalAmount, formatNumber, formatPercent } from '@/core/money';
import { type Booking, CATEGORIES, type Doc, type Expense, PLATFORMS } from '@/core/types';
import { AiUnavailable } from '@/data/backend';
import { useData, useStore } from '@/data/store';
import { useAccess, useMoney, usePartiesOf, usePropertyChoice } from '@/features/hooks';
import { PropertyField } from '@/features/PropertyField';
import { peekPendingFile, setPendingFile } from '@/features/pendingFile';
import { categoryLabel, dayLabel, monthLabel, useLocale, useT } from '@/i18n';
import { type PickedFile, pickDocument, pickPhoto, takePhoto } from '@/platform/pick';
import { Button, Choice, ConfirmButton, Notice, TextLink, Toggle } from '@/ui/controls';
import { AmountField, DateFields, Field, Label } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { FormScreen } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, platformColor, radius, space } from '@/ui/theme';

const CURRENCIES = ['XOF', 'EUR', 'USD'];

export default function EntryScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string; scan?: string }>();
  const { canEdit } = useAccess();
  // Someone with a view-only member link reads the entry instead of a form.
  if (!canEdit) return <EntryDetails kind={params.type === 'booking' ? 'booking' : 'expense'} id={params.id} />;
  return params.type === 'booking' ? <BookingForm id={params.id} /> : <ExpenseForm id={params.id} scan={params.scan === '1'} />;
}

/** Shared by both forms: which property, with the current filter as default. */
/** Converts between the amount typed and the account currency. */
function useRate(currency: string, initial?: number) {
  const profile = useStore((s) => s.data.profile);
  const fallback = currency === profile.currency ? 1 : (profile.fx[currency] ?? 1);
  const [custom, setCustom] = useState<string | null>(initial !== undefined && initial !== fallback ? String(initial) : null);
  const rate = custom !== null ? (evalAmount(custom) ?? fallback) : fallback;
  return { rate, custom, setCustom, fallback, foreign: currency !== profile.currency };
}

function ExpenseForm({ id, scan }: { id?: string; scan: boolean }) {
  const t = useT();
  const locale = useLocale();
  const data = useData();
  const { save, remove, addDoc, backend } = useStore.getState();
  const { owner, sees, isMe } = useAccess();
  const existing = data.expenses.find((x) => x.id === id);
  const profile = data.profile;

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? profile.currency);
  const [category, setCategory] = useState(existing?.category ?? 'other');
  const [date, setDate] = useState(existing?.date ?? today());
  const [vendor, setVendor] = useState(existing?.vendor ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [scope, setScope] = useState(existing?.scope ?? 'property');
  const [chargedTo, setChargedTo] = useState(existing?.charged_to ?? null);
  const [paidBy, setPaidBy] = useState(existing?.paid_by ?? null);
  const [excluded, setExcluded] = useState(existing?.excluded ?? false);
  const [more, setMore] = useState(existing ? existing.scope !== 'property' || existing.charged_to !== null : false);
  const [busy, setBusy] = useState(false);
  const place = usePropertyChoice(existing ? existing.property_id : undefined, owner);
  const { propertyId } = place;
  const { rate, custom, setCustom, fallback, foreign } = useRate(currency, existing?.fx_rate);
  const parties = usePartiesOf(propertyId);
  const docs = data.docs.filter((d) => existing && d.expense_id === existing.id);
  // Invoices already filed, chosen to be linked when the expense is saved.
  const [toLink, setToLink] = useState<string[]>([]);
  const [choosingDoc, setChoosingDoc] = useState(false);
  const loose = data.docs.filter((d) => !d.expense_id && !toLink.includes(d.id) && (!propertyId || !d.property_id || d.property_id === propertyId));

  const [file, setFile] = useState<PickedFile | null>(() => (scan ? peekPendingFile() : null));
  const [reading, setReading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const vendors = useMemo(() => [...new Set(data.expenses.map((x) => x.vendor).filter(Boolean))], [data.expenses]);
  const value = evalAmount(amount);
  // A general cost belongs to no property, so it can only be private.
  const managed = data.properties.find((p) => p.id === propertyId)?.kind === 'managed';
  const effectiveScope = !propertyId ? 'private' : scope === 'setup' && managed ? 'property' : scope;

  /** Asks the server to read the receipt and fills in what is still empty. */
  async function read(picked: PickedFile) {
    if (!picked.base64) return;
    setReading(true);
    setAiNote(null);
    try {
      const r = await backend.readReceipt(picked.base64, picked.mime);
      if (r.amount && !amount) setAmount(String(r.amount));
      if (r.currency && CURRENCIES.includes(r.currency)) setCurrency(r.currency);
      if (r.vendor && !vendor) setVendor(r.vendor);
      if (r.description && !description) setDescription(r.description);
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
      if (r.category && (CATEGORIES as readonly string[]).includes(r.category)) setCategory(r.category);
      setAiNote(t('Reçu lu. Vérifie les champs avant d’enregistrer.', 'Receipt read. Check the fields before saving.'));
    } catch (e) {
      if (e instanceof AiUnavailable && e.reason === 'quota') setAiNote(t('Limite de lectures atteinte pour aujourd’hui. Le reçu reste joint.', 'Daily reading limit reached. The receipt stays attached.'));
      else if (!(e instanceof AiUnavailable)) setAiNote(t('Lecture impossible. Le reçu reste joint, remplis les champs à la main.', 'Could not read it. The receipt stays attached; fill in the fields by hand.'));
    } finally {
      setReading(false);
    }
  }

  useEffect(() => {
    // Opened from the "add" menu with a photo: take it and read it, once.
    setPendingFile(null);
    if (!scan || !file) return;
    const timer = setTimeout(() => void read(file), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attach(pick: () => Promise<PickedFile | null>) {
    try {
      const picked = await pick();
      if (!picked) return;
      setFile(picked);
      if (!existing) void read(picked);
    } catch {
      useStore.setState({ error: t('Accès à l’appareil photo refusé. Autorise-le dans les réglages.', 'Camera access was refused. Allow it in Settings.') });
    }
  }

  async function submit() {
    if (value === null) return;
    setBusy(true);
    const row: Expense = {
      id: existing?.id ?? newId(),
      property_id: propertyId,
      date,
      // A generated occurrence stays in its month even if its date is edited.
      month: existing?.recurring_id ? existing.month : monthOf(date),
      category,
      vendor: vendor.trim(),
      description: description.trim(),
      currency,
      amount: value,
      fx_rate: rate,
      scope: effectiveScope,
      charged_to: effectiveScope === 'property' ? chargedTo : null,
      paid_by: paidBy,
      recurring_id: existing?.recurring_id ?? null,
      excluded,
      created_at: existing?.created_at ?? now(),
    };
    try {
      await save('expenses', row);
      if (file) await addDoc(file, { expense_id: row.id, property_id: propertyId });
      for (const d of data.docs.filter((x) => toLink.includes(x.id))) await save('docs', { ...d, expense_id: row.id, property_id: propertyId ?? d.property_id });
      useStore.getState().setMonth(row.month);
      router.back();
    } catch {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!existing) return;
    setBusy(true);
    // Its invoices stay filed, on their own (for a member, the server unlinks them).
    if (owner) for (const d of docs) await save('docs', { ...d, expense_id: null });
    await remove('expenses', existing.id);
    router.back();
  }

  return (
    <FormScreen
      title={existing ? t('Dépense', 'Expense') : t('Nouvelle dépense', 'New expense')}
      footer={<Button label={t('Enregistrer', 'Save')} onPress={submit} busy={busy} disabled={value === null || value === 0 || !place.chosen} />}>
      <PropertyField choice={place} editing={!!existing} />
      {existing?.recurring_id ? (
        <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, padding: space.lg }}>
          <Toggle
            value={excluded}
            onChange={setExcluded}
            label={t(`Exclure en ${monthLabel(existing.month, locale).toLowerCase()}`, `Skip in ${monthLabel(existing.month, locale)}`)}
            hint={t('Dépense récurrente. L’exclure ne touche ni les autres mois ni le réglage.', 'Recurring expense. Skipping it leaves other months and the setup untouched.')}
          />
        </View>
      ) : null}

      {reading ? <Notice icon="spark" text={t('Lecture du reçu en cours…', 'Reading the receipt…')} /> : aiNote ? <Notice icon="spark" tone="positive" text={aiNote} /> : null}

      <AmountField label={t('Montant', 'Amount')} value={amount} onChangeText={setAmount} currency={currency} autoFocus={!existing && !scan} />
      <Choice value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      {foreign ? <Field label={t(`Taux : 1 ${currency} en ${profile.currency}`, `Rate: 1 ${currency} in ${profile.currency}`)} value={custom ?? String(fallback)} onChangeText={setCustom} keyboardType="numbers-and-punctuation" /> : null}

      <View>
        <Label>{t('Catégorie', 'Category')}</Label>
        <Choice value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c as string, label: categoryLabel(c, locale) }))} />
      </View>


      <DateFields items={[{ label: t('Date', 'Date'), value: date, onChange: (d) => d && setDate(d) }]} />
      <Field label={t('Fournisseur', 'Vendor')} value={vendor} onChangeText={setVendor} suggestions={vendors} placeholder="Woyofal, Orange, Diarra…" />
      <Field label={t('Description', 'Description')} value={description} onChangeText={setDescription} multiline />

      {sees('invoices') ? (
      <View>
        <Label>{t('Justificatif', 'Receipt')}</Label>
        {docs.map((d) => (
          <DocLine key={d.id} doc={d} onRemove={() => void save('docs', { ...d, expense_id: null })} />
        ))}
        {data.docs
          .filter((d) => toLink.includes(d.id))
          .map((d) => (
            <DocLine key={d.id} doc={d} onRemove={() => setToLink(toLink.filter((x) => x !== d.id))} />
          ))}
        {file ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: space.sm, marginBottom: space.sm }}>
            {file.base64 ? <Image source={{ uri: `data:${file.mime};base64,${file.base64}` }} style={{ width: 56, height: 56, borderRadius: radius.sm }} contentFit="cover" /> : <Icon name="file" />}
            <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
              {file.name}
            </T>
            <TextLink label={t('Retirer', 'Remove')} onPress={() => setFile(null)} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button compact tone="quiet" icon="camera" label={t('Photo', 'Photo')} onPress={() => void attach(takePhoto)} style={{ flex: 1 }} />
            <Button compact tone="quiet" icon="image" label={t('Galerie', 'Library')} onPress={() => void attach(pickPhoto)} style={{ flex: 1 }} />
            <Button compact tone="quiet" icon="file" label="PDF" onPress={() => void attach(pickDocument)} style={{ flex: 1 }} />
          </View>
        )}
        {loose.length ? (
          choosingDoc ? (
            <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: space.sm, marginTop: space.sm, gap: 2 }}>
              {loose.map((d) => (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setToLink([...toLink, d.id]);
                    setChoosingDoc(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm }}>
                  <Icon name={d.mime === 'application/pdf' ? 'file' : 'image'} size={18} color={color.inkSoft} />
                  <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
                    {d.title || d.name || t('Facture', 'Invoice')}
                  </T>
                  {d.date ? <T variant="small" color={color.inkSoft}>{dayLabel(d.date, locale)}</T> : null}
                </Pressable>
              ))}
              <TextLink label={t('Annuler', 'Cancel')} onPress={() => setChoosingDoc(false)} />
            </View>
          ) : (
            <View style={{ marginTop: space.sm }}>
              <TextLink label={t(`Choisir une facture déjà rangée (${loose.length})`, `Pick an invoice already filed (${loose.length})`)} onPress={() => setChoosingDoc(true)} />
            </View>
          )
        ) : null}
      </View>
      ) : null}

      {propertyId ? (
        <>
          <TextLink label={more ? t('Masquer les options', 'Hide options') : t('Répartition et paiement', 'Split and payment')} onPress={() => setMore(!more)} />
          {more ? (
            <>
              <View>
                <Label>{t('À la charge de', 'Charged to')}</Label>
                <Choice
                  value={effectiveScope === 'property' ? (chargedTo ?? 'split') : effectiveScope}
                  onChange={(v) => {
                    setScope(v === 'private' || v === 'setup' ? v : 'property');
                    setChargedTo(v === 'private' || v === 'setup' || v === 'split' ? null : v);
                  }}
                  options={[
                    { value: 'split', label: t('Selon les règles du bien', 'Per the property rules') },
                    ...parties.map((p) => ({ value: p.id, label: isMe(p) ? t('Moi seule', 'Me only') : t(`${p.name} seul·e`, `${p.name} only`) })),
                    ...(managed ? [] : [{ value: 'setup', label: t('Mise en place', 'Set-up cost') }]),
                    ...(owner ? [{ value: 'private', label: t('Privée (mes frais)', 'Private (my costs)') }] : []),
                  ]}
                />
                <T variant="small" color={color.inkSoft} style={{ marginTop: 6 }}>
                  {effectiveScope === 'setup'
                    ? t('Une dépense de mise en place est payée par les apports de départ : elle ne compte ni dans le résultat du mois ni dans le bénéfice à partager, seulement dans ce qu’il reste à récupérer.', 'A set-up cost is paid out of the initial contributions: it counts neither in the month’s result nor in the profit to share, only in what is left to recover.')
                    : owner ? t('Une dépense privée compte dans ma rentabilité, jamais dans les comptes du bien ni dans un relevé partagé.', 'A private expense counts in my own profitability, never in the property books or a shared statement.') : ''}
                </T>
              </View>
              {parties.length > 1 ? (
                <View>
                  <Label>{t('Payée par', 'Paid by')}</Label>
                  <Choice value={paidBy} onChange={setPaidBy} options={parties.map((p) => ({ value: p.is_me ? null : p.id, label: isMe(p) ? t('Moi', 'Me') : p.name }))} />
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {existing && !existing.recurring_id ? <ConfirmButton label={t('Supprimer cette dépense', 'Delete this expense')} confirmLabel={t('Confirmer la suppression', 'Confirm deletion')} onConfirm={() => void destroy()} /> : null}
    </FormScreen>
  );
}

function BookingForm({ id }: { id?: string }) {
  const t = useT();
  const data = useData();
  const { save, remove } = useStore.getState();
  const { owner, isMe } = useAccess();
  const existing = data.bookings.find((b) => b.id === id);
  const profile = data.profile;

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? profile.currency);
  const [platform, setPlatform] = useState(existing?.platform ?? 'Airbnb');
  const [checkIn, setCheckIn] = useState(existing?.check_in ?? today());
  const [checkOut, setCheckOut] = useState<string | null>(existing ? existing.check_out : null);
  const [receivedOn, setReceivedOn] = useState<string | null>(existing ? existing.received_on : today());
  const [guest, setGuest] = useState(existing?.guest ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [commission, setCommission] = useState(existing?.commission_rate != null ? String(existing.commission_rate * 100) : '');
  const [receivedBy, setReceivedBy] = useState(existing?.received_by ?? null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const place = usePropertyChoice(existing ? existing.property_id : undefined, false);
  const { propertyId } = place;
  const { rate, custom, setCustom, fallback, foreign } = useRate(currency, existing?.fx_rate);
  const parties = usePartiesOf(propertyId);

  const property = data.properties.find((p) => p.id === propertyId);
  const rule = propertyId ? ruleFor(data.rules, propertyId, monthOf(checkIn)) : null;
  const value = evalAmount(amount);
  const nights = checkOut ? diffDays(checkIn, checkOut) : 0;
  const customCommission = commission.trim() === '' ? null : evalAmount(commission);
  const platforms = [...new Set([...PLATFORMS, ...data.bookings.map((b) => b.platform)])];

  async function submit() {
    if (value === null || !propertyId) return;
    setBusy(true);
    const row: Booking = {
      id: existing?.id ?? newId(),
      property_id: propertyId,
      platform,
      guest: guest.trim(),
      check_in: checkIn,
      check_out: checkOut && checkOut >= checkIn ? checkOut : null,
      received_on: receivedOn,
      currency,
      amount: value,
      fx_rate: rate,
      commission_rate: customCommission === null ? null : Math.min(Math.max(customCommission / 100, 0), 1),
      received_by: receivedBy,
      notes: notes.trim(),
      created_at: existing?.created_at ?? now(),
    };
    try {
      await save('bookings', row);
      useStore.getState().setMonth(monthOf(property?.revenue_basis === 'received' && receivedOn ? receivedOn : checkIn));
      router.back();
    } catch {
      setBusy(false);
    }
  }

  return (
    <FormScreen
      title={existing ? t('Revenu', 'Income') : t('Nouveau revenu', 'New income')}
      footer={<Button label={t('Enregistrer', 'Save')} onPress={submit} busy={busy} disabled={value === null || value === 0 || !propertyId} />}>
      <PropertyField choice={place} editing={!!existing} />
      <AmountField label={t('Montant net reçu', 'Net payout')} value={amount} onChangeText={setAmount} currency={currency} autoFocus={!existing} />
      <Choice value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      {foreign ? <Field label={t(`Taux : 1 ${currency} en ${profile.currency}`, `Rate: 1 ${currency} in ${profile.currency}`)} value={custom ?? String(fallback)} onChangeText={setCustom} keyboardType="numbers-and-punctuation" /> : null}

      <View>
        <Label>{t('Plateforme', 'Platform')}</Label>
        <Choice value={platform} onChange={setPlatform} options={platforms.map((p) => ({ value: p, label: p, dot: platformColor(p) }))} />
      </View>


      <View>
        <DateFields
          items={[
            { label: t('Arrivée', 'Check-in'), value: checkIn, onChange: (d) => d && setCheckIn(d) },
            { label: t('Départ', 'Check-out'), value: checkOut, onChange: setCheckOut, rangeStart: checkIn, optional: true },
          ]}
        />
        {nights > 0 ? (
          <T variant="small" color={color.inkSoft} style={{ marginTop: 6 }}>
            {t(`${nights} nuit${nights > 1 ? 's' : ''}`, `${nights} night${nights > 1 ? 's' : ''}`)}
            {value ? t(`, soit ${formatNumber((value * rate) / nights)} par nuit`, `, i.e. ${formatNumber((value * rate) / nights)} per night`) : ''}
          </T>
        ) : null}
      </View>

      <DateFields items={[{ label: t('Versement reçu le', 'Payout received on'), value: receivedOn, onChange: setReceivedOn, optional: true }]} />
      <Field label={t('Voyageur', 'Guest')} value={guest} onChangeText={setGuest} />
      <Field label={t('Notes', 'Notes')} value={notes} onChangeText={setNotes} multiline />

      {owner || parties.length > 1 ? <TextLink label={more ? t('Masquer les options', 'Hide options') : owner ? t('Commission et encaissement', 'Commission and collection') : t('Encaissement', 'Collection')} onPress={() => setMore(!more)} /> : null}
      {more ? (
        <>
          {owner ? <Field
            label={t('Ma commission sur ce revenu (%)', 'My commission on this income (%)')}
            value={commission}
            onChangeText={setCommission}
            keyboardType="numbers-and-punctuation"
            placeholder={t(`Règle du bien : ${formatPercent(rule?.commission_rate ?? 0)}`, `Property rule: ${formatPercent(rule?.commission_rate ?? 0)}`)}
          /> : null}
          {parties.length > 1 ? (
            <View>
              <Label>{t('Encaissé par', 'Collected by')}</Label>
              <Choice
                value={receivedBy}
                onChange={setReceivedBy}
                options={[{ value: null as string | null, label: t('Selon le bien', 'Per the property') }, ...parties.map((p) => ({ value: p.id as string | null, label: isMe(p) ? t('Moi', 'Me') : p.name }))]}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {existing ? (
        <ConfirmButton
          label={t('Supprimer ce revenu', 'Delete this income')}
          confirmLabel={t('Confirmer la suppression', 'Confirm deletion')}
          onConfirm={() => {
            setBusy(true);
            void remove('bookings', existing.id).then(() => router.back());
          }}
        />
      ) : null}
    </FormScreen>
  );
}

/** One attached invoice: tap to open it, "Détacher" keeps it filed on its own. */
function DocLine({ doc, onRemove }: { doc: Doc; onRemove: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: space.md, marginBottom: space.sm }}>
      <Icon name={doc.mime === 'application/pdf' ? 'file' : 'image'} color={color.inkSoft} />
      <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/invoice', params: { id: doc.id } })}>
        <T variant="label" numberOfLines={1}>
          {doc.title || doc.name || t('Justificatif', 'Receipt')}
        </T>
      </Pressable>
      <TextLink label={t('Détacher', 'Unlink')} onPress={onRemove} />
    </View>
  );
}

/** An entry as a view-only member sees it. */
function EntryDetails({ kind, id }: { kind: 'booking' | 'expense'; id?: string }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const { sees } = useAccess();
  const nameOf = (pid: string | null) => data.parties.find((p) => p.id === pid)?.name ?? '';
  const amount = (row: { amount: number; currency: string; fx_rate: number }) =>
    row.currency === data.profile.currency ? money(row.amount) : `${formatNumber(row.amount)} ${row.currency} (${money(row.amount * row.fx_rate)})`;

  if (kind === 'booking') {
    const b = data.bookings.find((x) => x.id === id);
    if (!b) return <FormScreen title={t('Revenu', 'Income')}><T color={color.inkSoft}>{t('Ce revenu n’existe plus.', 'This income no longer exists.')}</T></FormScreen>;
    const nights = b.check_out ? diffDays(b.check_in, b.check_out) : 0;
    return (
      <FormScreen title={t('Revenu', 'Income')}>
        <T variant="hero" tabular color={color.positive}>{amount(b)}</T>
        <Detail label={t('Plateforme', 'Platform')} value={b.platform} />
        <Detail label={t('Séjour', 'Stay')} value={[dayLabel(b.check_in, locale), b.check_out ? dayLabel(b.check_out, locale) : null].filter(Boolean).join(' → ') + (nights ? t(`, ${nights} nuit${nights > 1 ? 's' : ''}`, `, ${nights} night${nights > 1 ? 's' : ''}`) : '')} />
        {b.received_on ? <Detail label={t('Versement reçu le', 'Payout received on')} value={dayLabel(b.received_on, locale)} /> : null}
        {b.guest ? <Detail label={t('Voyageur', 'Guest')} value={b.guest} /> : null}
        {b.received_by ? <Detail label={t('Encaissé par', 'Collected by')} value={nameOf(b.received_by)} /> : null}
        {b.notes ? <Detail label={t('Notes', 'Notes')} value={b.notes} /> : null}
      </FormScreen>
    );
  }
  const x = data.expenses.find((e) => e.id === id);
  if (!x) return <FormScreen title={t('Dépense', 'Expense')}><T color={color.inkSoft}>{t('Cette dépense n’existe plus.', 'This expense no longer exists.')}</T></FormScreen>;
  const docs = sees('invoices') ? data.docs.filter((d) => d.expense_id === x.id) : [];
  return (
    <FormScreen title={t('Dépense', 'Expense')}>
      <T variant="hero" tabular color={color.negative}>{amount(x)}</T>
      <Detail label={t('Catégorie', 'Category')} value={categoryLabel(x.category, locale)} />
      <Detail label={t('Date', 'Date')} value={dayLabel(x.date, locale) + ' ' + x.date.slice(0, 4)} />
      {x.vendor ? <Detail label={t('Fournisseur', 'Vendor')} value={x.vendor} /> : null}
      {x.description ? <Detail label={t('Description', 'Description')} value={x.description} /> : null}
      {x.scope === 'setup' ? <Detail label={t('Type', 'Type')} value={t('Mise en place', 'Set-up cost')} /> : null}
      {x.paid_by ? <Detail label={t('Payée par', 'Paid by')} value={nameOf(x.paid_by)} /> : null}
      {docs.length ? (
        <View>
          <Label>{t('Justificatif', 'Receipt')}</Label>
          {docs.map((d) => (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/invoice', params: { id: d.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: space.md, marginBottom: space.sm }}>
              <Icon name={d.mime === 'application/pdf' ? 'file' : 'image'} color={color.inkSoft} />
              <T variant="label" style={{ flex: 1 }} numberOfLines={1}>{d.title || d.name || t('Justificatif', 'Receipt')}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </FormScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: color.line, paddingBottom: space.sm }}>
      <T variant="small" color={color.inkSoft}>{label}</T>
      <T variant="bodyMedium">{value}</T>
    </View>
  );
}
