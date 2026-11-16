import { useMemo } from 'react';

import { type FormatOptions, formatMoney } from '@/core/money';
import type { Party, Property } from '@/core/types';
import { useStore } from '@/data/store';
import { pigmentOf } from '@/ui/theme';

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
