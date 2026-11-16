import { View } from 'react-native';

import { T } from './Text';
import { color, pigmentDot } from './theme';

/** The mark: four soft bars, like a small chart. */
export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean }) {
  const bars = [
    { h: 0.5, tint: color.chartIncome },
    { h: 0.85, tint: color.chartLine },
    { h: 0.65, tint: color.chartExpense },
    { h: 1, tint: pigmentDot('baobab') },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ height: size, flexDirection: 'row', alignItems: 'flex-end', gap: size * 0.11 }}>
        {bars.map((b, i) => (
          <View key={i} style={{ width: size * 0.17, height: size * b.h, borderRadius: size * 0.08, backgroundColor: b.tint }} />
        ))}
      </View>
      {withName ? (
        <T variant="heading" style={{ fontSize: size * 0.64, lineHeight: size }}>
          Stayfolio
        </T>
      ) : null}
    </View>
  );
}
