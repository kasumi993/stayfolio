/**
 * Design tokens. Every colour, font and spacing value used in the app comes
 * from here, so the look can be adjusted in one place.
 *
 * Identity: indigo ink on pale paper, one warm mango accent for the action
 * of the moment, and a pigment per property so each place is recognisable.
 */

export const color = {
  ink: '#17143A',
  inkSoft: '#55527A',
  inkFaint: '#9997B5',
  paper: '#F3F1F8',
  surface: '#FFFFFF',
  line: '#E2DEEE',
  lineStrong: '#CBC6DE',
  mango: '#FFB01F',
  mangoInk: '#3A2600',
  positive: '#0B8A66',
  positiveSoft: '#DDF3EB',
  negative: '#C4234C',
  negativeSoft: '#FBE3E9',
  noticeSoft: '#FFF1D1',
  white: '#FFFFFF',
  onDark: 'rgba(255,255,255,0.74)',
  onDarkFaint: 'rgba(255,255,255,0.22)',
} as const;

/** Property colours. `all` is used when every property is shown together. */
export const pigment: Record<string, string> = {
  indigo: '#2B2580',
  bissap: '#8C1D4F',
  lagoon: '#0C6470',
  baobab: '#3C5A2B',
  laterite: '#A34427',
  all: '#1D1A45',
};
export const pigmentKeys = ['indigo', 'bissap', 'lagoon', 'baobab', 'laterite'];
export const pigmentOf = (key: string | undefined) => pigment[key ?? 'all'] ?? pigment.indigo;

export const platformColor = (platform: string): string =>
  ({ airbnb: '#FF6B8A', booking: '#6C9BFF', direct: '#FFB01F' })[platform.toLowerCase()] ?? '#B9B6D3';

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
