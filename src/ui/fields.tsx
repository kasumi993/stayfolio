/** Form inputs: text, amounts that accept sums, and dates with a calendar. */
import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';

import { addDays, addMonths, dateInMonth, daysInMonth, monthOf, today } from '@/core/dates';
import { evalAmount, formatMoney, isFormula } from '@/core/money';
import { WEEKDAYS, dayLabel, monthLabel, useLocale, useT } from '@/i18n';

import { IconButton } from './controls';
import { Icon } from './Icon';
import { T } from './Text';
import { color, font, radius, space } from './theme';

export function Label({ children }: { children: string }) {
  return (
    <T variant="label" color={color.inkSoft} style={{ marginBottom: 6 }}>
      {children}
    </T>
  );
}

const inputStyle = {
  minHeight: 50,
  borderRadius: radius.md,
  backgroundColor: color.surface,
  borderWidth: 1.5,
  borderColor: color.line,
  paddingHorizontal: space.lg,
  fontFamily: font.text,
  fontSize: 16,
  color: color.ink,
} as const;

interface FieldProps extends TextInputProps {
  label: string;
  /** Tappable suggestions shown under the input (for instance past vendors). */
  suggestions?: string[];
}

export function Field({ label, suggestions, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const typed = String(rest.value ?? '').toLowerCase();
  const matches = focused && suggestions ? suggestions.filter((s) => s.toLowerCase().includes(typed) && s.toLowerCase() !== typed).slice(0, 4) : [];
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.inkFaint}
        {...rest}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        style={[inputStyle, focused && { borderColor: color.ink }, rest.multiline && { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' }, style]}
      />
      {matches.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {matches.map((s) => (
            <Pressable key={s} onPress={() => rest.onChangeText?.(s)} style={{ paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.line }}>
              <T variant="small">{s}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Big amount input. Accepts sums like a spreadsheet cell (`175156+14000`)
 * and shows the result underneath while typing.
 */
export function AmountField({ label, value, onChangeText, currency, autoFocus }: { label: string; value: string; onChangeText: (v: string) => void; currency: string; autoFocus?: boolean }) {
  const t = useT();
  const result = evalAmount(value);
  const invalid = value.trim() !== '' && result === null;
  const hint = {
    invalid: t('Ce montant n’est pas lisible.', 'This amount cannot be read.'),
    empty: t('Un calcul fonctionne aussi : 175156+14000', 'A sum works too: 175156+14000'),
  };
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        keyboardType="numbers-and-punctuation"
        placeholder="0"
        placeholderTextColor={color.inkFaint}
        style={[inputStyle, { minHeight: 68, fontFamily: font.display, fontSize: 32, borderColor: invalid ? color.negative : color.line }]}
      />
      {invalid || isFormula(value) || !value ? (
        <T variant="small" color={invalid ? color.negative : color.inkSoft} style={{ marginTop: 6 }}>
          {invalid ? hint.invalid : result !== null && value ? `= ${formatMoney(result, currency)}` : hint.empty}
        </T>
      ) : null}
    </View>
  );
}

/** Month grid. Days between `rangeStart` and the selected day are tinted. */
export function Calendar({ value, onChange, rangeStart }: { value: string; onChange: (d: string) => void; rangeStart?: string }) {
  const locale = useLocale();
  const [month, setMonth] = useState(monthOf(value || today()));
  const first = dateInMonth(month, 1);
  // Monday-first offset of the first day.
  const offset = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i))];
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, marginTop: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="left" label="Mois précédent" onPress={() => setMonth(addMonths(month, -1))} />
        <T variant="bodyBold">{monthLabel(month, locale)}</T>
        <IconButton icon="right" label="Mois suivant" onPress={() => setMonth(addMonths(month, 1))} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS[locale].map((d, i) => (
          <T key={i} variant="small" color={color.inkFaint} align="center" style={{ width: `${100 / 7}%`, paddingVertical: 4 }}>
            {d}
          </T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          const selected = d === value;
          const inRange = !!d && !!rangeStart && d >= rangeStart && d < value;
          return (
            <Pressable key={i} disabled={!d} onPress={() => d && onChange(d)} style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              {d ? (
                <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? color.ink : inRange ? color.line : 'transparent' }}>
                  <T variant="label" color={selected ? color.white : d === today() ? color.negative : color.ink}>
                    {Number(d.slice(8))}
                  </T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export interface DateItem {
  label: string;
  value: string | null;
  onChange: (d: string | null) => void;
  /** Tints the days from this date up to the value (a stay). */
  rangeStart?: string;
  optional?: boolean;
}

/** One or several dates on a line, sharing a single calendar that opens below. */
export function DateFields({ items }: { items: DateItem[] }) {
  const locale = useLocale();
  const [open, setOpen] = useState<number | null>(null);
  const active = open === null ? null : items[open];
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {items.map((item, i) => (
          <View key={item.label} style={{ flex: 1 }}>
            <Label>{item.label}</Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => setOpen(open === i ? null : i)}
              style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md }, open === i && { borderColor: color.ink }]}>
              <T style={{ flex: 1 }} color={item.value ? color.ink : color.inkFaint} numberOfLines={1}>
                {item.value ? dayLabel(item.value, locale) : '—'}
              </T>
              {item.optional && item.value ? (
                <Pressable hitSlop={10} accessibilityLabel="Effacer" onPress={() => item.onChange(null)}>
                  <Icon name="close" size={16} color={color.inkSoft} />
                </Pressable>
              ) : (
                <Icon name="month" size={18} color={color.inkSoft} />
              )}
            </Pressable>
          </View>
        ))}
      </View>
      {active ? (
        <Calendar
          key={open}
          value={active.value ?? active.rangeStart ?? today()}
          rangeStart={active.rangeStart}
          onChange={(d) => {
            active.onChange(d);
            // Picking the arrival moves straight on to the departure.
            setOpen(open !== null && open + 1 < items.length && items[open + 1].rangeStart !== undefined ? open + 1 : null);
          }}
        />
      ) : null}
    </View>
  );
}
