/**
 * Two languages, French first. Screens write both wordings side by side:
 *
 *   const t = useT();
 *   t('Dépenses', 'Expenses')
 *
 * which keeps every sentence next to where it is used, and makes a missing
 * translation impossible.
 */
import { getLocales } from 'expo-localization';

import { formatPercent } from '@/core/money';
import type { Month } from '@/core/types';
import { useStore } from '@/data/store';

export type Locale = 'fr' | 'en';
export type Translate = (fr: string, en: string) => string;

export const deviceLocale = (): Locale => (getLocales()[0]?.languageCode === 'en' ? 'en' : 'fr');

export function useLocale(): Locale {
  const status = useStore((s) => s.status);
  const stored = useStore((s) => s.data.profile.locale);
  return status === 'ready' ? stored : deviceLocale();
}

export function useT(): Translate {
  const locale = useLocale();
  return (fr, en) => (locale === 'fr' ? fr : en);
}

const MONTHS = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `2026-11` → `Novembre 2026` */
export const monthLabel = (m: Month, locale: Locale): string =>
  `${cap(MONTHS[locale][Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;

/** `2026-11` → `Nov.` */
export const monthShort = (m: Month, locale: Locale): string => cap(shortName(MONTHS[locale][Number(m.slice(5, 7)) - 1]));

/** Three letters, except where that would make two months look alike (juin, juillet). */
const shortName = (month: string): string => (month === 'juin' ? 'juin' : month === 'juillet' ? 'juil' : month.slice(0, 3));

/** `2026-11-09` → `9 nov.` */
export function dayLabel(date: string, locale: Locale): string {
  const month = MONTHS[locale][Number(date.slice(5, 7)) - 1];
  const short = month.length > 4 ? shortName(month) + '.' : month;
  return locale === 'fr' ? `${Number(date.slice(8, 10))} ${short}` : `${cap(short)} ${Number(date.slice(8, 10))}`;
}

/** How a party shares in a property: "60 % du résultat", or both figures when they differ. */
export function shareLabel(share: { revenue: number; expense: number } | undefined, locale: Locale): string {
  if (!share || (!share.revenue && !share.expense)) return '';
  const fr = locale === 'fr';
  if (share.revenue === share.expense) return fr ? `${formatPercent(share.revenue)} du résultat` : `${formatPercent(share.revenue)} of the result`;
  const parts: string[] = [];
  if (share.revenue) parts.push(fr ? `${formatPercent(share.revenue)} des revenus` : `${formatPercent(share.revenue)} of income`);
  if (share.expense) parts.push(fr ? `${formatPercent(share.expense)} des dépenses` : `${formatPercent(share.expense)} of expenses`);
  return parts.join(', ');
}

/** `51` → `4 ans et 3 mois` */
export function durationLabel(months: number, locale: Locale): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const fr = locale === 'fr';
  const y = years ? (fr ? `${years} an${years > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''}`) : '';
  const m = rest ? (fr ? `${rest} mois` : `${rest} month${rest > 1 ? 's' : ''}`) : '';
  return [y, m].filter(Boolean).join(fr ? ' et ' : ' and ');
}

export const WEEKDAYS = { fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] };

const CATEGORY: Record<string, [string, string]> = {
  rent: ['Loyer', 'Rent'],
  cleaning: ['Ménage', 'Cleaning'],
  electricity: ['Électricité', 'Electricity'],
  water: ['Eau', 'Water'],
  internet: ['Internet', 'Internet'],
  supplies: ['Fournitures', 'Supplies'],
  equipment: ['Équipement', 'Equipment'],
  maintenance: ['Entretien', 'Maintenance'],
  transport: ['Transport', 'Transport'],
  taxes: ['Taxes et frais', 'Taxes and fees'],
  other: ['Autre', 'Other'],
};

export const categoryLabel = (key: string, locale: Locale): string =>
  CATEGORY[key]?.[locale === 'fr' ? 0 : 1] ?? key;

export const kindLabel = (kind: string, locale: Locale): string =>
  (
    ({
      owned: ['À moi seule', 'Mine alone'],
      partnership: ['En association', 'Partnership'],
      managed: ['Géré pour un propriétaire', 'Managed for an owner'],
    }) as Record<string, [string, string]>
  )[kind]?.[locale === 'fr' ? 0 : 1] ?? kind;
