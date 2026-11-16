import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { color, font } from './theme';

const variants = {
  hero: { fontFamily: font.display, fontSize: 46, lineHeight: 50, letterSpacing: -1.2 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: font.displayMedium, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  figure: { fontFamily: font.displayMedium, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.text, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: font.textBold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.textMedium, fontSize: 14, lineHeight: 19 },
  small: { fontFamily: font.text, fontSize: 13, lineHeight: 18 },
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
        style,
      ]}
    />
  );
}
