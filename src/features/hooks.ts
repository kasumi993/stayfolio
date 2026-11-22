import { useMemo, useState } from 'react';

import { type FormatOptions, formatMoney } from '@/core/money';
import type { MemberPage, Party, Property } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useT } from '@/i18n';
import { pigmentDot, pigmentOf } from '@/ui/theme';

/** Formats an amount in the account currency. */
export function useMoney() {
  const currency = useStore((s) => s.data.profile.currency);
  return (value: number, opts?: FormatOptions) => formatMoney(value, currency, opts);
}

/** The property filter shared by the tabs, resolved to the property itself. */
export function useSelection(): { property: Property | null; tint: string; active: Property[] } {
  const properties = useStore((s) => s.data.properties);
  const id = useStore((s) => s.propertyId);
  return useMemo(() => {
    const active = properties.filter((p) => !p.archived);
    const property = active.find((p) => p.id === id) ?? null;
    return { property, tint: pigmentOf(property?.color), active };
  }, [properties, id]);
}

/** Parties of a property, me first. */
export function usePartiesOf(propertyId: string | null | undefined): Party[] {
  const parties = useStore((s) => s.data.parties);
  return useMemo(
    () => parties.filter((p) => p.property_id === propertyId).sort((a, b) => Number(b.is_me) - Number(a.is_me)),
    [parties, propertyId],
  );
}

/** Which property a new entry goes to. Default: the one on screen, else the one used last. */
export function usePropertyChoice(initial: string | null | undefined, allowNone: boolean) {
  const t = useT();
  const { property, active } = useSelection();
  const data = useData();
  // Default: the property on screen, else the one used most recently.
  const suggested = (): string | null => {
    if (property) return property.id;
    const rows = [...data.expenses, ...data.bookings].filter((r) => active.some((p) => p.id === r.property_id));
    const latest = rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return latest?.property_id ?? active[0]?.id ?? null;
  };
  const [propertyId, setPropertyId] = useState<string | null>(initial !== undefined ? initial : suggested);
  const options = [
    ...active.map((p) => ({ value: p.id as string | null, label: p.name, dot: pigmentDot(p.color) })),
    ...(allowNone ? [{ value: null, label: t('Aucun (mon activité)', 'None (my business)') }] : []),
  ];
  return { propertyId, setPropertyId, options };
}


/**
 * What the person looking may do. The owner may do everything; someone who
 * opened a member link sees only the pages allowed and edits only if allowed.
 * The server enforces the same rules: this only decides what to show.
 */
export function useAccess() {
  const access = useStore((s) => s.backend.access);
  return useMemo(() => {
    const owner = !access;
    return {
      owner,
      access,
      canEdit: owner || access.canEdit,
      sees: (page: MemberPage) => owner || access.pages.includes(page),
      /** True for the owner's own party, only when the owner is the one looking. */
      isMe: (party: Pick<Party, 'is_me'>) => owner && party.is_me,
    };
  }, [access]);
}
