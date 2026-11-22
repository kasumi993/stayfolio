/**
 * Calendar of stays. Inside a property's space: the month as a grid, each
 * stay a bar from the middle of the arrival day to the middle of the departure
 * day, in the platform's colour. In the overview: one line per property, so
 * the whole portfolio's nights fit on one screen. Tapping a stay opens it.
 */
import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, View } from 'react-native';

import { base } from '@/core/calc';
import { type Segment, type Stay, bookedNights, segments, staysOf, undated, weeksOf } from '@/core/calendar';
import { addMonths, currentMonth, dateInMonth, daysInMonth, today } from '@/core/dates';
import type { Property } from '@/core/types';
import { useData, useStore } from '@/data/store';
import { useAccess, useMoney, useSelection } from '@/features/hooks';
import { PageHeader } from '@/features/PageHeader';
import { dayLabel, monthLabel, useLocale, useT } from '@/i18n';
import { Button, Dot, Empty, Notice, Row, SectionTitle } from '@/ui/controls';
import { Block, Cols, Screen, useWide } from '@/ui/layout';
import { T } from '@/ui/Text';
import { brand, color, pigmentDot, pigmentOf, platformColor, radius, space } from '@/ui/theme';

const WEEKDAYS = { fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'] };
const BAR = 20;
const LANE = BAR + 4;

/** Readable text on a platform colour: dark ink on light colours, white on dark ones. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? brand.ink : '#FFFFFF';
}

const openStay = (stay: Stay) => router.push({ pathname: '/entry', params: { type: 'booking', id: stay.booking.id } });

export default function CalendarScreen() {
  const t = useT();
  const locale = useLocale();
  const month = useStore((s) => s.month);
  const setMonth = useStore((s) => s.setMonth);
  const { property } = useSelection();

  return (
    <Screen>
      <PageHeader
        title={t('Calendrier', 'Calendar')}
        subtitle={monthLabel(month, locale)}
        stepper={{ onPrev: () => setMonth(addMonths(month, -1)), onNext: () => setMonth(addMonths(month, 1)), onReset: () => setMonth(currentMonth()) }}
      />
      {property ? <PropertyCalendar property={property} /> : <Timeline />}
    </Screen>
  );
}

function PropertyCalendar({ property }: { property: Property }) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const data = useData();
  const month = useStore((s) => s.month);
  const { canEdit } = useAccess();
  const stays = useMemo(() => staysOf(data, property.id, month), [data, property.id, month]);
  const loose = useMemo(() => undated(data, property.id, month), [data, property.id, month]);
  const weeks = useMemo(() => weeksOf(month), [month]);
  const { booked, available } = bookedNights(stays, month);
  const clashes = stays.filter((s) => s.clash).length;
  const now = today();

  return (
    <Cols ratio={[3, 2]} gap={space.xl}>
      <View>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {WEEKDAYS[locale].map((d, i) => (
            <T key={i} variant="small" color={color.inkFaint} style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </T>
          ))}
        </View>
        {weeks.map((week) => {
          const segs = segments(week, stays);
          const lanes = Math.max(1, ...segs.map((s) => s.lane + 1));
          return (
            <View key={week[0]} style={{ height: 30 + lanes * LANE + 6, borderTopWidth: 1, borderTopColor: color.line }}>
              <View style={{ flexDirection: 'row', position: 'absolute', inset: 0 } as object}>
                {week.map((day) => {
                  const inMonth = day.startsWith(month);
                  const isToday = day === now;
                  return (
                    <View key={day} style={{ flex: 1, alignItems: 'center', paddingTop: 5 }}>
                      <View style={{ minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? color.ink : 'transparent' }}>
                        <T variant="label" tabular color={isToday ? color.paper : inMonth ? color.ink : color.inkFaint}>
                          {Number(day.slice(8, 10))}
                        </T>
                      </View>
                    </View>
                  );
                })}
              </View>
              {segs.map((seg) => (
                <Bar key={seg.stay.booking.id} seg={seg} days={7} top={30 + seg.lane * LANE} />
              ))}
            </View>
          );
        })}
        <View style={{ borderTopWidth: 1, borderTopColor: color.line }} />
      </View>

      <View style={{ gap: space.lg, marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Figure label={t('Nuits réservées', 'Nights booked')} value={`${booked} / ${available}`} note={`${Math.round((booked / available) * 100)} %`} tint={pigmentOf(property.color)} />
          <Figure label={t('Nuits libres', 'Free nights')} value={String(available - booked)} note={t(`${stays.length} séjour${stays.length > 1 ? 's' : ''}`, `${stays.length} stay${stays.length > 1 ? 's' : ''}`)} tint={color.sunken} />
        </View>
        {clashes ? <Notice tone="negative" text={t(`${clashes} séjours se chevauchent : une même nuit est comptée deux fois. Vérifie les dates.`, `${clashes} stays overlap: the same night is counted twice. Check the dates.`)} /> : null}
        {loose.length ? (
          <Notice
            text={t(
              `${loose.length} revenu${loose.length > 1 ? 's' : ''} de ce mois sans date de départ : ajoute-la pour ${loose.length > 1 ? 'les' : 'le'} voir ici.`,
              `${loose.length} income ${loose.length > 1 ? 'entries' : 'entry'} this month without a departure date: add it to see ${loose.length > 1 ? 'them' : 'it'} here.`,
            )}
          />
        ) : null}

        <View>
          <SectionTitle>{t('Séjours du mois', 'Stays this month')}</SectionTitle>
          {stays.length || loose.length ? (
            <Block>
              {[...stays.map((s) => s.booking), ...loose].map((b, i, all) => {
                const stay = stays.find((s) => s.booking === b);
                return (
                  <Row
                    key={b.id}
                    leading={<Dot tint={platformColor(b.platform)} size={10} />}
                    title={stay ? `${dayLabel(stay.from, locale)} → ${dayLabel(stay.to, locale)}` : dayLabel(b.check_in, locale)}
                    subtitle={[stay ? t(`${stay.nights} nuit${stay.nights > 1 ? 's' : ''}`, `${stay.nights} night${stay.nights > 1 ? 's' : ''}`) : t('départ à préciser', 'departure missing'), b.platform, b.guest].filter(Boolean).join(', ')}
                    value={money(base(b))}
                    note={stay?.clash ? t('chevauche', 'overlaps') : undefined}
                    onPress={() => router.push({ pathname: '/entry', params: { type: 'booking', id: b.id } })}
                    last={i === all.length - 1}
                  />
                );
              })}
            </Block>
          ) : (
            <Empty title={t('Aucun séjour ce mois-ci', 'No stays this month')} text={t('Les revenus avec une date d’arrivée et de départ apparaissent ici.', 'Income with arrival and departure dates shows up here.')}>
              {canEdit ? <Button compact icon="plus" label={t('Ajouter un revenu', 'Add income')} onPress={() => router.push({ pathname: '/entry', params: { type: 'booking' } })} /> : null}
            </Empty>
          )}
        </View>
      </View>
    </Cols>
  );
}

/** Overview: one line per property for the month. */
function Timeline() {
  const t = useT();
  const locale = useLocale();
  const wide = useWide();
  const data = useData();
  const month = useStore((s) => s.month);
  const setProperty = useStore((s) => s.setProperty);
  const { active } = useSelection();
  const days = useMemo(() => Array.from({ length: daysInMonth(month) }, (_, i) => dateInMonth(month, i + 1)), [month]);
  const rows = useMemo(() => active.map((p) => ({ property: p, stays: staysOf(data, p.id, month) })), [active, data, month]);
  const now = today();
  const cell = wide ? 34 : 30;
  const scroller = useRef<ScrollViewInstance>(null);
  const nameWidth = wide ? 170 : 112;

  if (!active.length) return <Empty title={t('Aucun logement', 'No property yet')} text={t('Ajoute un logement pour voir son calendrier.', 'Add a property to see its calendar.')} />;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Names stay in place while the days scroll. */}
        <View style={{ width: nameWidth }}>
          <View style={{ height: 40 }} />
          {rows.map(({ property, stays }) => {
            const { booked, available } = bookedNights(stays, month);
            return (
              <Pressable
                key={property.id}
                accessibilityRole="button"
                accessibilityLabel={t(`Ouvrir ${property.name}`, `Open ${property.name}`)}
                onPress={() => setProperty(property.id)}
                style={({ pressed }) => ({ height: 52, justifyContent: 'center', paddingRight: space.sm, borderTopWidth: 1, borderTopColor: color.line, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Dot tint={pigmentDot(property.color)} size={8} />
                  <T variant="label" numberOfLines={1} style={{ flex: 1 }}>
                    {property.name}
                  </T>
                </View>
                <T variant="small" color={color.inkSoft}>
                  {Math.round((booked / available) * 100)} %
                </T>
              </Pressable>
            );
          })}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          ref={scroller}
          // This month: start a couple of days before today.
          onLayout={() => scroller.current?.scrollTo({ x: now.startsWith(month) ? Math.max(0, (Number(now.slice(8, 10)) - 3) * cell) : 0, animated: false })}
          key={month}>
          <View style={{ width: cell * days.length }}>
            <View style={{ flexDirection: 'row', height: 40 }}>
              {days.map((d) => {
                const weekday = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
                return (
                  <View key={d} style={{ width: cell, alignItems: 'center', justifyContent: 'center' }}>
                    <T variant="small" color={color.inkFaint}>
                      {WEEKDAYS[locale][weekday]}
                    </T>
                    <T variant="label" tabular color={d === now ? color.paper : color.ink} style={d === now ? { backgroundColor: color.ink, borderRadius: 9, paddingHorizontal: 5, overflow: 'hidden' } : undefined}>
                      {Number(d.slice(8, 10))}
                    </T>
                  </View>
                );
              })}
            </View>
            {rows.map(({ property, stays }) => (
              <View key={property.id} style={{ height: 52, borderTopWidth: 1, borderTopColor: color.line }}>
                <View style={{ flexDirection: 'row', position: 'absolute', inset: 0 } as object}>
                  {days.map((d) => {
                    const weekend = [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
                    return <View key={d} style={{ width: cell, backgroundColor: weekend ? color.sunken : 'transparent' }} />;
                  })}
                </View>
                {segments(days, stays).map((seg) => (
                  <Bar key={seg.stay.booking.id} seg={seg} days={days.length} top={16 + seg.lane * 8} compact />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <T variant="small" color={color.inkSoft}>
        {t('Touche un logement pour entrer dans son espace et voir son mois en détail.', 'Tap a property to open its space and see its month in detail.')}
      </T>
    </View>
  );
}

function Bar({ seg, days, top, compact }: { seg: Segment; days: number; top: number; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const b = seg.stay.booking;
  const bg = platformColor(b.platform);
  const label = b.guest || b.platform;
  const r = BAR / 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`${label}, du ${dayLabel(seg.stay.from, locale)} au ${dayLabel(seg.stay.to, locale)}`, `${label}, ${dayLabel(seg.stay.from, locale)} to ${dayLabel(seg.stay.to, locale)}`)}
      onPress={() => openStay(seg.stay)}
      style={({ pressed }) => ({
        position: 'absolute',
        top,
        height: BAR,
        left: `${(seg.start / days) * 100}%`,
        width: `${((seg.end - seg.start) / days) * 100}%`,
        paddingLeft: 1,
        paddingRight: 1,
        opacity: pressed ? 0.75 : 1,
      })}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 6,
          backgroundColor: bg,
          borderTopLeftRadius: seg.cutStart ? 0 : r,
          borderBottomLeftRadius: seg.cutStart ? 0 : r,
          borderTopRightRadius: seg.cutEnd ? 0 : r,
          borderBottomRightRadius: seg.cutEnd ? 0 : r,
          borderWidth: seg.stay.clash ? 2 : 0,
          borderColor: color.negative,
          overflow: 'hidden',
        }}>
        {!compact || seg.end - seg.start >= 2 ? (
          <T variant="small" numberOfLines={1} color={textOn(bg)} style={{ fontSize: 11.5, lineHeight: 14 }}>
            {label}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

function Figure({ label, value, note, tint }: { label: string; value: string; note: string; tint: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tint, borderRadius: radius.lg, padding: space.lg, gap: 2 }}>
      <T variant="label" color={color.inkSoft}>
        {label}
      </T>
      <T variant="title" tabular>
        {value}
      </T>
      <T variant="small" color={color.inkSoft}>
        {note}
      </T>
    </View>
  );
}
