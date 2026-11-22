/** One line per income or expense, used by the home screen and the entries tab. */
import { router } from 'expo-router';
import { View } from 'react-native';

import { base, nightsOf } from '@/core/calc';
import { formatMoney } from '@/core/money';
import type { Booking, Expense, Property } from '@/core/types';
import { useStore } from '@/data/store';
import { useMoney } from '@/features/hooks';
import { categoryLabel, dayLabel, useLocale, useT } from '@/i18n';
import { Dot, Row } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { color, platformColor } from '@/ui/theme';

export function BookingRow({ booking: b, property, last }: { booking: Booking; property?: Property; last: boolean }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const currency = useStore((s) => s.data.profile.currency);
  const n = nightsOf(b);
  const stay = b.check_out ? `${dayLabel(b.check_in, locale)} – ${dayLabel(b.check_out, locale)}` : dayLabel(b.check_in, locale);
  return (
    <Row
      title={b.guest ? `${b.platform}, ${b.guest}` : b.platform}
      subtitle={[property?.name, stay, n ? t(`${n} nuit${n > 1 ? 's' : ''}`, `${n} night${n > 1 ? 's' : ''}`) : null].filter(Boolean).join(', ')}
      value={money(base(b), { sign: true })}
      valueColor={color.positive}
      note={b.currency !== currency ? formatMoney(b.amount, b.currency) : undefined}
      leading={<Dot tint={platformColor(b.platform)} size={10} />}
      onPress={() => router.push({ pathname: '/entry', params: { type: 'booking', id: b.id } })}
      last={last}
    />
  );
}

export function ExpenseRow({ expense: x, property, last }: { expense: Expense; property?: Property; last: boolean }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const hasDoc = useStore((s) => s.data.docs.some((d) => d.expense_id === x.id));
  const label = categoryLabel(x.category, locale);
  const title = x.description || x.vendor || label;
  const tags = [x.excluded ? t('exclue ce mois', 'excluded this month') : null, x.scope === 'private' ? t('privée', 'private') : null, x.scope === 'setup' ? t('mise en place', 'set-up') : null].filter(Boolean);
  return (
    <Row
      title={title}
      subtitle={[property?.name, label === title ? null : label, x.vendor && x.vendor !== title ? x.vendor : null, dayLabel(x.date, locale), ...tags].filter(Boolean).join(', ')}
      value={money(-base(x))}
      note={hasDoc ? t('facture jointe', 'invoice attached') : undefined}
      leading={x.recurring_id ? <Icon name="repeat" size={15} color={color.inkFaint} /> : x.scope === 'private' ? <Icon name="lock" size={15} color={color.inkFaint} /> : <View style={{ width: 15 }} />}
      dimmed={x.excluded}
      onPress={() => router.push({ pathname: '/entry', params: { type: 'expense', id: x.id } })}
      last={last}
    />
  );
}

