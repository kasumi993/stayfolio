/**
 * The drawings of the app, kept simple on purpose (plain Views and a little
 * SVG, no chart library):
 *  - Ring: a share of a whole, as a circular gauge;
 *  - Progress: how far an amount is from a target;
 *  - Bars: two values per period (income and expenses);
 *  - Trend: one value over time, as a line;
 *  - Breakdown: shares of a total;
 *  - Tile: one key figure on a soft tint.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { T } from './Text';
import { color, radius, space } from './theme';

/** A circular gauge. `value` is a fraction between 0 and 1. */
export function Ring({ value, size = 64, stroke = 8, tint = color.ring, children }: { value: number; size?: number; stroke?: number; tint?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const shown = Math.min(1, Math.max(0, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.white} strokeOpacity={0.9} strokeWidth={stroke} fill="none" />
        {shown > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${length * shown} ${length}`} fill="none" /> : null}
      </Svg>
      {children}
    </View>
  );
}

/** A thin bar filling towards a target, with its label and what remains. */
export function Progress({ label, value, target, note, done }: { label: string; value: number; target: number; note: string; done: boolean }) {
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <T variant="label">{label}</T>
        <T variant="label" color={done ? color.positive : color.inkSoft}>
          {note}
        </T>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color.sunken }}>
        <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: done ? color.chartIncome : color.chartLine }} />
      </View>
    </View>
  );
}

/** A bare gauge, for places that write their own caption. `value` runs from 0 to 1. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(1, Math.max(0, value));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: color.whiteSoft }}>
      <View style={{ width: `${pct * 100}%`, minWidth: pct > 0 ? 6 : 0, height: 6, borderRadius: 3, backgroundColor: color.ink }} />
    </View>
  );
}

export function Legend({ items }: { items: { label: string; tint: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 4 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.tint }} />
          <T variant="small" color={color.inkSoft}>
            {item.label}
          </T>
        </View>
      ))}
    </View>
  );
}

export interface BarPoint {
  key: string;
  label: string;
  income: number;
  expenses: number;
}

/** Pairs of bars, one pair per period. Tapping a period selects it. */
export function Bars({ points, selected, onSelect, height = 132 }: { points: BarPoint[]; selected?: string; onSelect?: (key: string) => void; height?: number }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expenses)));
  const bar = points.length > 8 ? 8 : 14;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {points.map((p) => {
        const active = p.key === selected;
        return (
          <Pressable key={p.key} accessibilityLabel={p.label} disabled={!onSelect} onPress={() => onSelect?.(p.key)} style={{ flex: 1, alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 6, borderRadius: radius.sm, backgroundColor: active ? color.sunken : 'transparent' }}>
            <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
              <View style={{ width: bar, height: Math.max(2, (p.income / max) * height), borderRadius: 4, backgroundColor: color.chartIncome }} />
              <View style={{ width: bar, height: Math.max(2, (p.expenses / max) * height), borderRadius: 4, backgroundColor: color.chartExpense }} />
            </View>
            <T variant="small" color={active ? color.ink : color.inkFaint} numberOfLines={1}>
              {p.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A line through one value per period, with a zero line when values cross it. */
export function Trend({ values, labels, height = 120 }: { values: number[]; labels: string[]; height?: number }) {
  const width = 600; // drawing units; the SVG stretches to its container
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * width : width / 2);
  const y = (v: number) => 6 + (1 - (v - min) / span) * (height - 12);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={color.lineStrong} strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        {values.length > 1 ? <Path d={path} stroke={color.chartLine} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {labels.map((l, i) => (
          <T key={i} variant="small" color={color.inkFaint}>
            {l}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Shares of a total, largest first, each with a thin bar. */
export function Breakdown({ items, format }: { items: { label: string; value: number; tint: string }[]; format: (v: number) => string }) {
  const total = items.reduce((t, i) => t + i.value, 0) || 1;
  return (
    <View style={{ gap: space.md }}>
      {items.map((item) => (
        <View key={item.label} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <T variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.label}
            </T>
            <T variant="label" tabular>
              {format(item.value)}
              <T variant="small" color={color.inkFaint}>
                {'  '}
                {Math.round((item.value / total) * 100)} %
              </T>
            </T>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: color.sunken }}>
            <View style={{ width: `${(item.value / total) * 100}%`, height: 6, borderRadius: 3, backgroundColor: item.tint }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** One key figure on a soft tint, optionally with a small drawing on the right. */
export function Tile({ label, value, note, tint, aside }: { label: string; value: string; note?: string; tint: string; aside?: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: tint, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="label" color={color.inkSoft} numberOfLines={1}>
          {label}
        </T>
        <T variant="title" tabular numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>
          {value}
        </T>
        {note ? (
          <T variant="small" color={color.inkSoft} numberOfLines={1}>
            {note}
          </T>
        ) : null}
      </View>
      {aside}
    </View>
  );
}

/** Tiles in a grid: two per row on a phone, all in one row on a wide screen. */
export function Tiles({ children, wide }: { children: ReactNode[]; wide: boolean }) {
  if (wide) return <View style={{ flexDirection: 'row', gap: space.md }}>{children}</View>;
  const rows: ReactNode[][] = [];
  children.forEach((child, i) => (i % 2 ? rows[rows.length - 1].push(child) : rows.push([child])));
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
          {row}
        </View>
      ))}
    </View>
  );
}
