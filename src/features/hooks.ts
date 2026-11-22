import { useMemo, useState } from 'react';

import { type FormatOptions, formatMoney } from '@/core/money';
import type { MemberPage, Party, Property } from '@/core/types';
import { useStore } from '@/data/store';
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
export interface PropertyChoice {
  propertyId: string | null;
  setPropertyId: (id: string | null) => void;
  options: { value: string | null; label: string; dot?: string }[];
  /** False until a property (or "none") was picked: the form cannot be saved. */
  chosen: boolean;
  /** Shown as a fixed banner instead of a choice. */
  locked: boolean;
  unlock: () => void;
}

/**
 * The property a form writes to. Inside a property's space it is that
 * property, shown locked; in the overview there is no default when several
 * properties exist, so an entry never lands in the wrong one by accident.
 */
export function usePropertyChoice(initial: string | null | undefined, allowNone: boolean): PropertyChoice {
  const t = useT();
  const { property, active } = useSelection();
  const start = initial !== undefined ? initial : property ? property.id : active.length === 1 && !allowNone ? active[0].id : undefined;
  const [value, setValue] = useState<string | null | undefined>(start);
  const [locked, setLocked] = useState(start !== undefined);
  const options = [
    ...active.map((p) => ({ value: p.id as string | null, label: p.name, dot: pigmentDot(p.color) })),
    ...(allowNone ? [{ value: null, label: t('Aucun (mon activité)', 'None (my business)') }] : []),
  ];
  return { propertyId: value ?? null, setPropertyId: setValue, options, chosen: value !== undefined, locked: locked && value !== undefined, unlock: () => setLocked(false) };
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
