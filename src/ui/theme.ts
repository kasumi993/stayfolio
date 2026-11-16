/**
 * Design tokens and themes. Every colour, font and spacing value used in the
 * app comes from here, so the look can be adjusted in one place.
 *
 * The look: a white page, thin lines, plenty of air, and soft pastel tints
 * that carry meaning (green = income, rose = expenses, blue = occupancy).
 *
 * Two themes share the same token names:
 *   - `pastel` (default): sage, sky, blush and butter on white;
 *   - `indigo`: the same layout with stronger, deeper colours.
 *
 * How switching works: `color` is one shared object. `applyTheme` swaps its
 * values, and the root layout re-creates the screens (see src/app/_layout.tsx),
 * so every style picks up the new palette. Components therefore read colours
 * inside their render, never in a top-level constant.
 *
 * To add a theme: add an entry to `themes` with every token filled in, and a
 * label in the settings screen. Nothing else changes.
 */

interface Theme {
  color: {
    ink: string;
    inkSoft: string;
    inkFaint: string;
    /** Page background. */
    paper: string;
    /** Inputs and floating panels. */
    surface: string;
    /** Quiet fills: the sidebar, pressed states, empty tracks. */
    sunken: string;
    line: string;
    lineStrong: string;
    /** The action of the moment: main buttons, the "+" button. */
    accent: string;
    accentInk: string;
    positive: string;
    positiveSoft: string;
    negative: string;
    negativeSoft: string;
    noticeSoft: string;
    white: string;
    whiteSoft: string;
    /** A chosen chip, calendar day or menu entry. */
    selected: string;
    onSelected: string;
    selectedBorder: string;
    /** Charts. */
    chartIncome: string;
    chartExpense: string;
    chartLine: string;
    ring: string;
    /** Backgrounds of the key-figure tiles. */
    tintIncome: string;
    tintExpense: string;
    tintOccupancy: string;
    tintNight: string;
    /** Dimmed backdrop behind dialogs. */
    veil: string;
  };
  /** A soft tint and a stronger shade per property colour. `all` = every property. */
  pigment: Record<string, { tint: string; strong: string }>;
  platform: Record<string, string>;
}

const themes = {
  pastel: {
    color: {
      ink: '#22252A',
      inkSoft: '#646A73',
      inkFaint: '#A1A6AE',
      paper: '#FFFFFF',
      surface: '#FFFFFF',
      sunken: '#F6F7F5',
      line: '#ECEEEC',
      lineStrong: '#D8DBD8',
      accent: '#CDEBD8',
      accentInk: '#17452E',
      positive: '#2C8A5C',
      positiveSoft: '#E5F4EA',
      negative: '#CF5068',
      negativeSoft: '#FCEAEE',
      noticeSoft: '#FDF5DC',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.82)',
      selected: '#E5F4EA',
      onSelected: '#17452E',
      selectedBorder: '#8ECDA8',
      chartIncome: '#8ED0AC',
      chartExpense: '#F2A9B8',
      chartLine: '#7FB2EA',
      ring: '#7FB2EA',
      tintIncome: '#E8F5EC',
      tintExpense: '#FCECEF',
      tintOccupancy: '#E6F0FB',
      tintNight: '#FDF4D8',
      veil: 'rgba(34,37,42,0.32)',
    },
    pigment: {
      indigo: { tint: '#E6F0FB', strong: '#7FB2EA' },
      bissap: { tint: '#FCECEF', strong: '#EE9BAD' },
      lagoon: { tint: '#E3F4EE', strong: '#6CC5A9' },
      baobab: { tint: '#FDF4D8', strong: '#E6C45C' },
      laterite: { tint: '#F8EDE3', strong: '#DDAE84' },
      all: { tint: '#F1F2F0', strong: '#9AA0A8' },
    },
    platform: { airbnb: '#F2A9B8', booking: '#8DB9EE', direct: '#EBCB6B', other: '#C7CBD1' },
  },
  indigo: {
    color: {
      ink: '#17143A',
      inkSoft: '#55527A',
      inkFaint: '#9997B5',
      paper: '#FFFFFF',
      surface: '#FFFFFF',
      sunken: '#F5F4FA',
      line: '#E6E3F0',
      lineStrong: '#CBC6DE',
      accent: '#2B2580',
      accentInk: '#FFFFFF',
      positive: '#0B8A66',
      positiveSoft: '#DDF3EB',
      negative: '#C4234C',
      negativeSoft: '#FBE3E9',
      noticeSoft: '#FFF1D1',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.82)',
      selected: '#17143A',
      onSelected: '#FFFFFF',
      selectedBorder: '#17143A',
      chartIncome: '#FFB01F',
      chartExpense: '#2B2580',
      chartLine: '#C4234C',
      ring: '#0C6470',
      tintIncome: '#FFF3D6',
      tintExpense: '#E9E7F7',
      tintOccupancy: '#E0F1F3',
      tintNight: '#F6E6EC',
      veil: 'rgba(23,20,58,0.4)',
    },
    pigment: {
      indigo: { tint: '#E9E7F7', strong: '#2B2580' },
      bissap: { tint: '#F6E6EC', strong: '#8C1D4F' },
      lagoon: { tint: '#E0F1F3', strong: '#0C6470' },
      baobab: { tint: '#E8F0E1', strong: '#3C5A2B' },
      laterite: { tint: '#F7E9E3', strong: '#A34427' },
      all: { tint: '#EFEEF5', strong: '#55527A' },
    },
    platform: { airbnb: '#FF6B8A', booking: '#6C9BFF', direct: '#FFB01F', other: '#B9B6D3' },
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;
export const themeNames = Object.keys(themes) as ThemeName[];
export const defaultTheme: ThemeName = 'pastel';
export const isThemeName = (v: unknown): v is ThemeName => typeof v === 'string' && v in themes;

let active: Theme = themes[defaultTheme];

/** The colours of the active theme. Read it while rendering. */
export const color: Theme['color'] = { ...active.color };

/** Makes a theme the active one. The caller re-creates the screens afterwards. */
export function applyTheme(name: ThemeName): void {
  active = themes[name];
  Object.assign(color, active.color);
}

/** Keys a property can pick as its colour. Stored on the property, theme-independent. */
export const pigmentKeys = ['indigo', 'bissap', 'lagoon', 'baobab', 'laterite'];

const pigment = (key?: string) => active.pigment[key ?? 'all'] ?? active.pigment.indigo;

/** Soft background tint of a property (or of "all properties" when no key is given). */
export const pigmentOf = (key?: string): string => pigment(key).tint;

/** The same pigment, strong enough for a small dot or a chart. */
export const pigmentDot = (key?: string): string => pigment(key).strong;

export const platformColor = (platform: string): string => active.platform[platform.toLowerCase()] ?? active.platform.other;

/** Fixed order of soft colours for breakdowns (expense categories…). */
export const seriesColors = (): string[] => [
  color.chartExpense,
  color.chartLine,
  color.chartIncome,
  pigmentDot('baobab'),
  pigmentDot('laterite'),
  pigmentDot('lagoon'),
  color.inkFaint,
];

export const font = {
  display: 'PlusJakartaSans_600SemiBold',
  text: 'PlusJakartaSans_400Regular',
  textMedium: 'PlusJakartaSans_500Medium',
  textBold: 'PlusJakartaSans_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Forms and reading pages never stretch wider than this. */
export const maxWidth = 560;
/** Width of the content area on a large screen. */
export const pageWidth = 1120;
/** From this window width up, the app uses its desktop layout. */
export const wideFrom = 960;
