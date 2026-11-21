import { View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { T } from './Text';
import { brand, color, isDark } from './theme';

/**
 * The mark: four bars of a chart whose tops, cut at an angle, draw the roof
 * of a house. On the ink of the brand in every theme. The same drawing is used
 * for the app icons (scripts in docs/OPERATIONS.md).
 *
 * Drawn on a 120 × 120 grid.
 */
const BARS = [
  '26,54.6 40,42.8 40,96 26,96',
  '44,39.5 58,27.7 58,96 44,96',
  '62,27.7 76,39.5 76,96 62,96',
  '80,42.8 94,54.6 94,96 80,96',
];

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect width={120} height={120} rx={28} fill={brand.ink} stroke={isDark() ? color.lineStrong : 'none'} strokeWidth={isDark() ? 2 : 0} />
      {BARS.map((points, i) => (
        <Polygon key={i} points={points} fill={brand.bars[i]} />
      ))}
    </Svg>
  );
}

export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <View accessible accessibilityLabel="Stayfolio" style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.36 }}>
      <Mark size={size} />
      {withName ? (
        <T variant="heading" style={{ fontSize: size * 0.62, lineHeight: size, letterSpacing: -0.2 }}>
          Stayfolio
        </T>
      ) : null}
    </View>
  );
}
