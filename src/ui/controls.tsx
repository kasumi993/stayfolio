/** Buttons, chips, rows: the small building blocks of every screen. */
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { T } from './Text';
import { color, radius, space } from './theme';

type Tone = 'primary' | 'dark' | 'quiet' | 'danger';

const tones: Record<Tone, { bg: string; fg: string; border?: string }> = {
  primary: { bg: color.mango, fg: color.mangoInk },
  dark: { bg: color.ink, fg: color.white },
  quiet: { bg: 'transparent', fg: color.ink, border: color.lineStrong },
  danger: { bg: 'transparent', fg: color.negative, border: color.negativeSoft },
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  tone?: Tone;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, tone = 'primary', icon, busy, disabled, compact, style }: ButtonProps) {
  const c = tones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 40 : 52,
          paddingHorizontal: compact ? space.lg : space.xl,
          borderRadius: radius.md,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1.5 : 0,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {busy ? <ActivityIndicator color={c.fg} /> : icon ? <Icon name={icon} size={19} color={c.fg} /> : null}
      <T variant={compact ? 'label' : 'bodyBold'} color={c.fg}>
        {label}
      </T>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tint = color.ink, bg = 'transparent' }: { icon: IconName; onPress: () => void; label: string; tint?: string; bg?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} color={tint} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, dot }: { label: string; selected?: boolean; onPress: () => void; dot?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: radius.pill,
        backgroundColor: selected ? color.ink : color.surface,
        borderWidth: 1.5,
        borderColor: selected ? color.ink : color.line,
        opacity: pressed ? 0.7 : 1,
      })}>
      {dot ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} /> : null}
      <T variant="label" color={selected ? color.white : color.ink}>
        {label}
      </T>
    </Pressable>
  );
}

/** A wrapping group of chips where exactly one is selected. */
export function Choice<V extends string | null>({ value, options, onChange }: { value: V; options: { value: V; label: string; dot?: string }[]; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} dot={o.dot} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1 }}>
        <T variant="bodyBold">{label}</T>
        {hint ? (
          <T variant="small" color={color.inkSoft}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: color.ink, false: color.lineStrong }} thumbColor={color.white} />
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  note?: string;
  leading?: ReactNode;
  onPress?: () => void;
  dimmed?: boolean;
  last?: boolean;
}

/** A ledger line: what it is on the left, how much on the right. */
export function Row({ title, subtitle, value, valueColor, note, leading, onPress, dimmed, last }: RowProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.line,
        opacity: pressed ? 0.55 : dimmed ? 0.45 : 1,
      })}>
      {leading}
      <View style={{ flex: 1 }}>
        <T variant="bodyBold" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" color={color.inkSoft} numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {value ? (
          <T variant="figure" color={valueColor} tabular style={dimmed ? { textDecorationLine: 'line-through' } : undefined}>
            {value}
          </T>
        ) : null}
        {note ? (
          <T variant="small" color={color.inkSoft}>
            {note}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.xs, minHeight: 32 }}>
      <T variant="heading">{children}</T>
      {action}
    </View>
  );
}

export function TextLink({ label, onPress, tint = color.ink }: { label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <T variant="label" color={tint} style={{ textDecorationLine: 'underline' }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Notice({ text, tone = 'notice', icon = 'alert', action }: { text: string; tone?: 'notice' | 'negative' | 'positive'; icon?: IconName; action?: ReactNode }) {
  const bg = { notice: color.noticeSoft, negative: color.negativeSoft, positive: color.positiveSoft }[tone];
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: bg, borderRadius: radius.md, padding: space.md }}>
      <Icon name={icon} size={19} />
      <View style={{ flex: 1, gap: space.xs }}>
        <T variant="label">{text}</T>
        {action}
      </View>
    </View>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <View style={{ paddingVertical: space.xxl, gap: space.sm, alignItems: 'flex-start' }}>
      <T variant="heading">{title}</T>
      <T color={color.inkSoft}>{text}</T>
      {children ? <View style={{ marginTop: space.md, gap: space.sm, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

export const Dot = ({ tint, size = 10 }: { tint: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }} />
);

/**
 * A destructive button that asks for a second tap instead of opening a dialog
 * (system alerts do not exist on the web).
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, icon = 'trash' }: { label: string; confirmLabel: string; onConfirm: () => void; icon?: IconName }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return armed ? (
    <Button tone="dark" icon={icon} label={confirmLabel} onPress={onConfirm} style={{ backgroundColor: color.negative }} />
  ) : (
    <Button tone="danger" icon={icon} label={label} onPress={() => setArmed(true)} />
  );
}
