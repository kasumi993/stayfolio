/**
 * Design tokens and themes. Every colour, font and spacing value used in the
 * app comes from here, so the look can be adjusted in one place.
 *
 * Two themes share the same token names:
 *   - `pastel` (default): soft tinted panels with dark text;
 *   - `indigo`: deep coloured panels with light text and a mango accent.
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
    paper: string;
    surface: string;
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
    /** Text and icons on the coloured header panels ("hero"). */
    onHero: string;
    onHeroSoft: string;
    /** Empty track of bars and free nights, on a hero. */
    heroTrack: string;
    /** Filled part of the revenue bar, on a hero. */
    heroBar: string;
    /** Small highlights on a hero: the "reached" tick, the brand name. */
    heroMark: string;
    /** A chosen chip or calendar day. */
    selected: string;
    onSelected: string;
    selectedBorder: string;
    chartIncome: string;
    chartExpense: string;
  };
  /** Background of a property's header panel. `all` = every property together. */
  pigment: Record<string, string>;
  /** Stronger shade of the same pigments, for small dots and swatches. */
  dot: Record<string, string>;
  platform: Record<string, string>;
}

const themes = {
  pastel: {
    color: {
      ink: '#352F4D',
      inkSoft: '#6C6585',
      inkFaint: '#A49EB8',
      paper: '#FAF7FC',
      surface: '#FFFFFF',
      line: '#EEE8F4',
      lineStrong: '#DAD1E8',
      accent: '#FFC8A2',
      accentInk: '#4F2A12',
      positive: '#2E8B6C',
      positiveSoft: '#DFF4EB',
      negative: '#C2476A',
      negativeSoft: '#FCE6EC',
      noticeSoft: '#FFF2D9',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.8)',
      onHero: '#352F4D',
      onHeroSoft: 'rgba(53,47,77,0.7)',
      heroTrack: 'rgba(53,47,77,0.1)',
      heroBar: '#FFFFFF',
      heroMark: '#352F4D',
      selected: '#E3DBFB',
      onSelected: '#352F4D',
      selectedBorder: '#B7A8F0',
      chartIncome: '#FFB48A',
      chartExpense: '#B9ABEB',
    },
    pigment: { indigo: '#DDD5FB', bissap: '#FAD4E1', lagoon: '#CBEDE8', baobab: '#DDECC9', laterite: '#FCDCC6', all: '#E4DCF5' },
    dot: { indigo: '#A692F0', bissap: '#EE8DAE', lagoon: '#62C9BE', baobab: '#A3C777', laterite: '#F2A374', all: '#8E86A8' },
    platform: { airbnb: '#F78FA9', booking: '#8DAEF6', direct: '#F5BE5B', other: '#B5AFC9' },
  },
  indigo: {
    color: {
      ink: '#17143A',
      inkSoft: '#55527A',
      inkFaint: '#9997B5',
      paper: '#F3F1F8',
      surface: '#FFFFFF',
      line: '#E2DEEE',
      lineStrong: '#CBC6DE',
      accent: '#FFB01F',
      accentInk: '#3A2600',
      positive: '#0B8A66',
      positiveSoft: '#DDF3EB',
      negative: '#C4234C',
      negativeSoft: '#FBE3E9',
      noticeSoft: '#FFF1D1',
      white: '#FFFFFF',
      whiteSoft: 'rgba(255,255,255,0.8)',
      onHero: '#FFFFFF',
      onHeroSoft: 'rgba(255,255,255,0.74)',
      heroTrack: 'rgba(255,255,255,0.22)',
      heroBar: '#FFB01F',
      heroMark: '#FFB01F',
      selected: '#17143A',
      onSelected: '#FFFFFF',
      selectedBorder: '#17143A',
      chartIncome: '#FFB01F',
      chartExpense: '#2E2A55',
    },
    pigment: { indigo: '#2B2580', bissap: '#8C1D4F', lagoon: '#0C6470', baobab: '#3C5A2B', laterite: '#A34427', all: '#1D1A45' },
    dot: { indigo: '#2B2580', bissap: '#8C1D4F', lagoon: '#0C6470', baobab: '#3C5A2B', laterite: '#A34427', all: '#1D1A45' },
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

/** Header-panel colour of a property (or of "all properties" when no key is given). */
export const pigmentOf = (key?: string): string => active.pigment[key ?? 'all'] ?? active.pigment.indigo;

/** The same pigment, strong enough for a small dot. */
export const pigmentDot = (key?: string): string => active.dot[key ?? 'all'] ?? active.dot.indigo;

export const platformColor = (platform: string): string => active.platform[platform.toLowerCase()] ?? active.platform.other;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  text: 'HankenGrotesk_400Regular',
  textMedium: 'HankenGrotesk_500Medium',
  textBold: 'HankenGrotesk_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 22, xl: 30, pill: 999 } as const;

/** Content never stretches wider than a large phone, even in a desktop browser. */
export const maxWidth = 560;
