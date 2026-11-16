/**
 * Renders a shared statement. Used twice: as the preview before publishing,
 * and as the public page an owner or partner opens from their link.
 * It only ever receives the frozen snapshot, never live data.
 */
import { View } from 'react-native';

import { formatMoney } from '@/core/money';
import type { SharedStatement } from '@/core/sharing';
import { type Locale, type Translate, categoryLabel, dayLabel, monthLabel } from '@/i18n';
import { Row, SectionTitle } from '@/ui/controls';
import { Block } from '@/ui/layout';
import { T } from '@/ui/Text';
import { color, pigmentOf, radius, space } from '@/ui/theme';

export function periodLabel(s: SharedStatement, locale: Locale): string {
  const from = monthLabel(s.period.from, locale);
  return s.period.from === s.period.to ? from : `${from} – ${monthLabel(s.period.to, locale)}`;
}

export function StatementView({ statement: s, locale, t }: { statement: SharedStatement; locale: Locale; t: Translate }) {
  const money = (v: number, sign = false) => formatMoney(v, s.currency, { sign });
  const total = s.totals;
  const sharesAll = Math.abs(total.shareExpenses - total.expenses) < 1;
  return (
    <View>
      <View style={{ backgroundColor: pigmentOf(s.property.color), borderRadius: radius.xl, padding: space.xl }}>
        <T variant="label" color={color.onHeroSoft}>
          {t(`Relevé pour ${s.audience}`, `Statement for ${s.audience}`)}
        </T>
        <T variant="title" color={color.onHero} style={{ marginTop: 2 }}>
          {s.property.name}
        </T>
        <T color={color.onHeroSoft}>{periodLabel(s, locale)}</T>
        <T variant="hero" color={color.onHero} style={{ marginTop: space.lg }} adjustsFontSizeToFit numberOfLines={1}>
          {money(total.net, true)}
        </T>
        <T color={color.onHeroSoft}>
          {total.due > 0.5
            ? t(`Reste à vous verser : ${money(total.due)}`, `Still to be paid to you: ${money(total.due)}`)
            : total.due < -0.5
              ? t(`Reste à verser de votre part : ${money(-total.due)}`, `Still due from you: ${money(-total.due)}`)
              : t('Tout est réglé pour cette période.', 'Everything is settled for this period.')}
        </T>
      </View>

      <SectionTitle>{t('En résumé', 'Summary')}</SectionTitle>
      <Block>
        <Row title={total.commission === null ? t('Revenus nets de frais de gestion', 'Income net of management fees') : t('Revenus', 'Income')} subtitle={t(`${s.bookings.length} réservation${s.bookings.length > 1 ? 's' : ''}, ${total.nights} nuit${total.nights > 1 ? 's' : ''}`, `${s.bookings.length} booking${s.bookings.length > 1 ? 's' : ''}, ${total.nights} night${total.nights > 1 ? 's' : ''}`)} value={money(total.revenue)} />
        {total.commission ? <Row title={t('Frais de gestion', 'Management fee')} value={money(-total.commission)} /> : null}
        <Row title={t('Dépenses du logement', 'Property expenses')} value={money(-total.expenses)} />
        {!sharesAll ? <Row title={t('Votre part des revenus', 'Your share of income')} value={money(total.shareRevenue)} /> : null}
        {!sharesAll ? <Row title={t('Votre part des dépenses', 'Your share of expenses')} value={money(-total.shareExpenses)} /> : null}
        <Row title={t('Votre résultat', 'Your result')} value={money(total.net, true)} valueColor={total.net < 0 ? color.negative : color.positive} last />
      </Block>

      {s.months.length > 1 ? (
        <>
          <SectionTitle>{t('Mois par mois', 'Month by month')}</SectionTitle>
          <Block>
            {s.months.map((m, i) => (
              <Row key={m.month} title={monthLabel(m.month, locale)} subtitle={t(`Revenus ${money(m.revenue)}, dépenses ${money(m.expenses)}`, `Income ${money(m.revenue)}, expenses ${money(m.expenses)}`)} value={money(m.revenue - m.expenses, true)} last={i === s.months.length - 1} />
            ))}
          </Block>
        </>
      ) : null}

      <SectionTitle>{t('Réservations', 'Bookings')}</SectionTitle>
      {s.bookings.length ? (
        <Block>
          {s.bookings.map((b, i) => (
            <Row
              key={i}
              title={b.check_out ? `${dayLabel(b.check_in, locale)} → ${dayLabel(b.check_out, locale)}` : dayLabel(b.check_in, locale)}
              subtitle={[b.platform, b.nights ? t(`${b.nights} nuit${b.nights > 1 ? 's' : ''}`, `${b.nights} night${b.nights > 1 ? 's' : ''}`) : null].filter(Boolean).join(', ')}
              value={money(b.amount)}
              last={i === s.bookings.length - 1}
            />
          ))}
        </Block>
      ) : (
        <T color={color.inkSoft}>{t('Aucune réservation sur la période.', 'No bookings in this period.')}</T>
      )}

      <SectionTitle>{t('Dépenses', 'Expenses')}</SectionTitle>
      {s.expenses.length ? (
        <Block>
          {s.expenses.map((x, i) => (
            <Row key={i} title={x.description || categoryLabel(x.category, locale)} subtitle={[categoryLabel(x.category, locale), x.vendor, dayLabel(x.date, locale)].filter(Boolean).join(', ')} value={money(-x.amount)} last={i === s.expenses.length - 1} />
          ))}
        </Block>
      ) : (
        <T color={color.inkSoft}>{t('Aucune dépense sur la période.', 'No expenses in this period.')}</T>
      )}

      {s.transfers.length ? (
        <>
          <SectionTitle>{t('Versements', 'Payments')}</SectionTitle>
          <Block>
            {s.transfers.map((x, i) => (
              <Row key={i} title={x.received ? t('Reçu', 'Received') : t('Versé', 'Paid in')} subtitle={[dayLabel(x.date, locale), x.note].filter(Boolean).join(', ')} value={money(x.amount)} last={i === s.transfers.length - 1} />
            ))}
          </Block>
        </>
      ) : null}

      <T variant="small" color={color.inkSoft} style={{ marginTop: space.xl }}>
        {t(`Préparé par ${s.manager || 'Stayfolio'} le ${dayLabel(s.generated_at.slice(0, 10), locale)} ${s.generated_at.slice(0, 4)}. Montants en ${s.currency}.`, `Prepared by ${s.manager || 'Stayfolio'} on ${dayLabel(s.generated_at.slice(0, 10), locale)}, ${s.generated_at.slice(0, 4)}. Amounts in ${s.currency}.`)}
      </T>
    </View>
  );
}
