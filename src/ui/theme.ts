/**
 * Design tokens and themes. Every colour, font and spacing value used in the
 * app comes from here, so the look can be adjusted in one place.
 *
 * The look: a white page, thin lines, plenty of air, and soft pastel tints
 * that carry meaning (green = income, rose = expenses, blue = occupancy).
 *
 * Three themes share the same token names:
 *   - `pastel` (default): sage, sky, blush and butter on white;
 *   - `dark`: the same pastels on the ink of the logo, for the evening;
 *   - `mono`: black and white on a black page, outlines instead of fills.
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
  /** Light text on dark backgrounds: drives the status bar and the page behind the app. */
  scheme: 'light' | 'dark';
  /** Draws tinted surfaces as outlines on white instead of fills. */
  outline?: boolean;
  /** A soft tint and a stronger shade per property colour. `all` = every property. */
  pigment: Record<string, { tint: string; strong: string }>;
  platform: Record<string, string>;
}

const themes = {
  // "K" (22 Nov 2026): engraved Marcellus titles, Hanken Grotesk text, slate
  // ink on warm sand, white cards with fine sand rules. Calm and timeless.
  pastel: {
    color: {
      ink: '#24303C',
      inkSoft: '#6B7581',
      inkFaint: '#A3AAB2',
      paper: '#F6F4EF',
      surface: '#FFFFFF',
      sunken: '#EEEBE4',
      line: '#E2DDD2',
      lineStrong: '#CBC4B6',
      accent: '#24303C',
      accentInk: '#F6F4EF',
      positive: '#2E6F5A',
      positiveSoft: '#E2EEE8',
      negative: '#A14857',
      negativeSoft: '#F5E4E6',
      noticeSoft: '#F4ECD8',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.82)',
      selected: '#E6ECF2',
      onSelected: '#24303C',
      selectedBorder: '#7D8FA1',
      chartIncome: '#7FAA95',
      chartExpense: '#CC939D',
      chartLine: '#5B7189',
      ring: '#5B7189',
      tintIncome: '#E4EDE7',
      tintExpense: '#F3E6E6',
      tintOccupancy: '#E6ECF2',
      tintNight: '#F1EADB',
      veil: 'rgba(36,48,60,0.34)',
    },
    scheme: 'light',
    pigment: {
      indigo: { tint: '#E3E9F1', strong: '#5B7189' },
      bissap: { tint: '#F3E3E6', strong: '#B5687A' },
      lagoon: { tint: '#E0EEE8', strong: '#4F8C76' },
      baobab: { tint: '#F2EAD6', strong: '#B8964E' },
      laterite: { tint: '#F3E6DA', strong: '#B57A55' },
      all: { tint: '#ECE9E2', strong: '#8A8F96' },
    },
    platform: { airbnb: '#DDA6B0', booking: '#A3B8D1', direct: '#DCC28A', other: '#C8C3B9' },
  },
  // Black and white, dark: a true black page, white ink, no coloured fills.
  // Surfaces are fine grey outlines; actions and selections a white one.
  mono: {
    color: {
      ink: '#F5F5F5',
      inkSoft: '#9C9C9C',
      inkFaint: '#626262',
      paper: '#000000',
      surface: '#000000',
      sunken: '#000000',
      line: '#232323',
      lineStrong: '#4A4A4A',
      accent: '#000000',
      accentInk: '#F5F5F5',
      positive: '#F5F5F5',
      positiveSoft: '#000000',
      negative: '#F5F5F5',
      negativeSoft: '#000000',
      noticeSoft: '#000000',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.16)',
      selected: '#000000',
      onSelected: '#F5F5F5',
      selectedBorder: '#F5F5F5',
      chartIncome: '#F5F5F5',
      chartExpense: '#5E5E5E',
      chartLine: '#F5F5F5',
      ring: '#F5F5F5',
      tintIncome: '#000000',
      tintExpense: '#000000',
      tintOccupancy: '#000000',
      tintNight: '#000000',
      veil: 'rgba(0,0,0,0.72)',
    },
    scheme: 'dark',
    outline: true,
    pigment: {
      indigo: { tint: '#000000', strong: '#F5F5F5' },
      bissap: { tint: '#000000', strong: '#F5F5F5' },
      lagoon: { tint: '#000000', strong: '#F5F5F5' },
      baobab: { tint: '#000000', strong: '#F5F5F5' },
      laterite: { tint: '#000000', strong: '#F5F5F5' },
      all: { tint: '#000000', strong: '#F5F5F5' },
    },
    platform: { airbnb: '#000000', booking: '#000000', direct: '#000000', other: '#000000' },
  },
  // Night version of "K": slate ink as the page, sand text, the same muted colours.
  dark: {
    color: {
      ink: '#EFEBE3',
      inkSoft: '#A5ADB6',
      inkFaint: '#6E7884',
      paper: '#151B21',
      surface: '#1C242C',
      sunken: '#181F26',
      line: '#29333D',
      lineStrong: '#3A4652',
      accent: '#E9E3D5',
      accentInk: '#1C242C',
      positive: '#90C7AF',
      positiveSoft: '#1E2E28',
      negative: '#E59BA7',
      negativeSoft: '#352329',
      noticeSoft: '#332D1F',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.14)',
      selected: '#26323E',
      onSelected: '#EFEBE3',
      selectedBorder: '#7D8FA1',
      chartIncome: '#90C7AF',
      chartExpense: '#E59BA7',
      chartLine: '#A3B8D1',
      ring: '#A3B8D1',
      tintIncome: '#1E2B27',
      tintExpense: '#2E2329',
      tintOccupancy: '#1F2A36',
      tintNight: '#2E2A1F',
      veil: 'rgba(0,0,0,0.6)',
    },
    scheme: 'dark',
    pigment: {
      indigo: { tint: '#1F2A36', strong: '#A3B8D1' },
      bissap: { tint: '#2E2329', strong: '#E0A2AF' },
      lagoon: { tint: '#1C2C27', strong: '#90C7AF' },
      baobab: { tint: '#2E2A1F', strong: '#DCC28A' },
      laterite: { tint: '#2F251E', strong: '#D9A47F' },
      all: { tint: '#222A32', strong: '#8A939C' },
    },
    platform: { airbnb: '#E0A2AF', booking: '#A3B8D1', direct: '#DCC28A', other: '#5C6773' },
  },
} satisfies Record<string, Theme>;

/** The logo's own colours: the same in every theme. */
export const brand = { ink: '#1C2430', bars: ['#8ED0AC', '#7FB2EA', '#F2A9B8', '#E6C45C'] } as const;

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
  // On the web, the page behind the app shows while scrolling past the edges.
  if (typeof document !== 'undefined') {
    document.body.style.background = active.color.paper;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', active.color.paper);
  }
}

/** Whether the active theme is dark. */
export const isDark = (): boolean => active.scheme === 'dark';

/** Whether the active theme draws outlines instead of tinted fills. */
export const isOutline = (): boolean => !!active.outline;

/**
 * Background for a tinted surface (tile, card, banner, button). In the black
 * and white theme it becomes a thin black outline on white.
 */
export const fill = (tint: string, width = 1): { backgroundColor: string; borderWidth?: number; borderColor?: string } =>
  active.outline ? { backgroundColor: color.surface, borderWidth: width, borderColor: color.lineStrong } : { backgroundColor: tint };

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
  /** Engraved roman capitals feel: titles and the big figure of a screen. */
  display: 'Marcellus_400Regular',
  text: 'HankenGrotesk_400Regular',
  textMedium: 'HankenGrotesk_500Medium',
  textBold: 'HankenGrotesk_600SemiBold',
  /** Big amounts: clear digits, a zero that cannot be taken for an O. */
  figure: 'HankenGrotesk_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Forms and reading pages never stretch wider than this. */
export const maxWidth = 560;
/** Width of the content area on a large screen. */
export const pageWidth = 1120;
/** From this window width up, the app uses its desktop layout. */
export const wideFrom = 960;
