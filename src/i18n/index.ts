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
