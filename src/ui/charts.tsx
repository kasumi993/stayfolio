/**
 * The three drawings of the app. They are plain Views (no chart library):
 *  - ThresholdBar: revenue against the rent and break-even marks;
 *  - Nights: one cell per night of the month, coloured by booking platform;
 *  - YearBars: revenue and expenses for each month of a year.
 */
import { Pressable, View } from 'react-native';

import { nightsOf } from '@/core/calc';
import { addDays, dateInMonth, daysInMonth, monthOf, today } from '@/core/dates';
import { formatCompact } from '@/core/money';
import type { Booking, Month } from '@/core/types';

import { T } from './Text';
import { color, platformColor, space } from './theme';

interface Mark {
  label: string;
  value: number;
}

/** A bar that fills with revenue, with ticks at the amounts it has to reach. */
export function ThresholdBar({ value, marks }: { value: number; marks: Mark[] }) {
  const shown = marks.filter((m) => m.value > 0).sort((a, b) => a.value - b.value);
  const scale = Math.max(value, ...shown.map((m) => m.value), 1) * 1.08;
  const pct = (v: number) => `${Math.min(100, (Math.max(0, v) / scale) * 100)}%` as const;
  return (
    <View style={{ paddingBottom: 34 }}>
      <View style={{ height: 14, borderRadius: 7, backgroundColor: color.onDarkFaint, overflow: 'hidden' }}>
        <View style={{ width: pct(value), height: '100%', borderRadius: 7, backgroundColor: color.mango }} />
      </View>
      {shown.map((m, i) => {
        const reached = value >= m.value;
        // Labels of close marks would collide: the second one sits a line lower.
        const crowded = i > 0 && (m.value - shown[i - 1].value) / scale < 0.3;
        const rightSide = m.value / scale > 0.7;
        return (
          <View key={m.label} style={{ position: 'absolute', left: pct(m.value), top: -4, alignItems: rightSide ? 'flex-end' : 'flex-start' }}>
            <View style={{ width: 2, height: crowded ? 38 : 24, backgroundColor: color.white, marginLeft: -1 }} />
            <T variant="small" color={reached ? color.white : color.onDark} style={{ marginTop: 2, marginLeft: rightSide ? 0 : -1, marginRight: rightSide ? 1 : 0, position: rightSide ? 'absolute' : 'relative', right: rightSide ? 0 : undefined, top: rightSide ? (crowded ? 40 : 26) : undefined, width: rightSide ? 150 : undefined, textAlign: rightSide ? 'right' : 'left' }} numberOfLines={1}>
              {m.label} {formatCompact(m.value)}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** Which platform occupies each night of the month (index 0 = the 1st). */
export function nightsByPlatform(bookings: Booking[], month: Month): (string | null)[] {
  const cells: (string | null)[] = Array(daysInMonth(month)).fill(null);
  for (const b of bookings) {
    for (let i = 0; i < Math.max(1, nightsOf(b)); i++) {
      const night = addDays(b.check_in, i);
      if (monthOf(night) === month) cells[Number(night.slice(8)) - 1] = b.platform;
    }
  }
  return cells;
}

/** The month as a strip of nights: filled when booked, hollow when free. */
export function Nights({ bookings, month, onDark = true }: { bookings: Booking[]; month: Month; onDark?: boolean }) {
  const cells = nightsByPlatform(bookings, month);
  const now = today();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {cells.map((platform, i) => {
        const isToday = dateInMonth(month, i + 1) === now;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <View
              style={{
                alignSelf: 'stretch',
                height: 26,
                borderRadius: 3,
                backgroundColor: platform ? platformColor(platform) : onDark ? color.onDarkFaint : color.line,
              }}
            />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isToday ? (onDark ? color.white : color.ink) : 'transparent' }} />
          </View>
        );
      })}
    </View>
  );
}

export function Legend({ items, onDark }: { items: { label: string; tint: string }[]; onDark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 4 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.tint }} />
          <T variant="small" color={onDark ? color.onDark : color.inkSoft}>
            {item.label}
          </T>
        </View>
      ))}
    </View>
  );
}

interface YearPoint {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
}

/** Twelve pairs of bars. Tapping a month selects it. */
export function YearBars({ points, selected, onSelect, height = 150 }: { points: YearPoint[]; selected?: string; onSelect?: (key: string) => void; height?: number }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.revenue, p.expenses)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {points.map((p) => {
        const active = p.key === selected;
        return (
          <Pressable key={p.key} accessibilityLabel={p.label} onPress={() => onSelect?.(p.key)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              <View style={{ width: 9, height: Math.max(2, (p.revenue / max) * height), borderRadius: 3, backgroundColor: color.mango }} />
              <View style={{ width: 9, height: Math.max(2, (p.expenses / max) * height), borderRadius: 3, backgroundColor: color.ink, opacity: 0.85 }} />
            </View>
            <T variant="small" color={active ? color.ink : color.inkFaint} style={active ? { textDecorationLine: 'underline' } : undefined}>
              {p.label.slice(0, 1)}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal share bars for a breakdown (by platform, by category). */
export function Breakdown({ items, format }: { items: { label: string; value: number; tint?: string }[]; format: (v: number) => string }) {
  const total = items.reduce((t, i) => t + i.value, 0) || 1;
  return (
    <View style={{ gap: space.md }}>
      {items.map((item) => (
        <View key={item.label} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="label">{item.label}</T>
            <T variant="label" tabular>
              {format(item.value)}
              <T variant="small" color={color.inkSoft}>
                {'  '}
                {Math.round((item.value / total) * 100)} %
              </T>
            </T>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: color.line }}>
            <View style={{ width: `${(item.value / total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: item.tint ?? color.ink }} />
          </View>
        </View>
      ))}
    </View>
  );
}
