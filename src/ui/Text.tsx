import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { color, font } from './theme';

const variants = {
  /** The one big figure of a screen. */
  hero: { fontFamily: font.display, fontSize: 34, lineHeight: 42, letterSpacing: -0.8 },
  title: { fontFamily: font.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: font.textBold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  /** Amounts in lists and tiles. */
  figure: { fontFamily: font.textBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.text, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: font.textMedium, fontSize: 15, lineHeight: 22 },
  bodyBold: { fontFamily: font.textBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: font.textMedium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: font.text, fontSize: 12.5, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

interface Props extends TextProps {
  variant?: keyof typeof variants;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Aligns digits in columns. */
  tabular?: boolean;
}

/** The only text component: picks a type style and a colour from the theme. */
export function T({ variant = 'body', color: c = color.ink, align, tabular, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={[
        variants[variant],
        { color: c, textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        // Amounts never use the display face: its round zero reads as a letter O.
        tabular && (variant === 'hero' || variant === 'title') && { fontFamily: font.figure, letterSpacing: -0.6 },
        style,
      ]}
    />
  );
}
