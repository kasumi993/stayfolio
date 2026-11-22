/**
 * The stays calendar: which nights are booked, laid out as bars that run from
 * the middle of the arrival day to the middle of the departure day, the way
 * a host reads a booking. Pure functions; the screen only draws them.
 */
import { addDays, dateInMonth, daysInMonth, diffDays } from './dates';
import type { Booking, Data, ID, ISODate, Month } from './types';

export interface Stay {
  booking: Booking;
  /** Arrival day. */
  from: ISODate;
  /** Departure day (the morning the guest leaves). */
  to: ISODate;
  nights: number;
  /** Shares at least one night with another stay of the same property. */
  clash: boolean;
}

/** Stays of one property that touch a month (arrival or departure inside, or spanning it). */
export function staysOf(data: Data, propertyId: ID, month: Month): Stay[] {
  const first = dateInMonth(month, 1);
  const afterLast = addDays(dateInMonth(month, daysInMonth(month)), 1);
  const all = data.bookings
    .filter((b) => b.property_id === propertyId && b.check_out && diffDays(b.check_in, b.check_out) > 0)
    .map((b) => ({ booking: b, from: b.check_in, to: b.check_out!, nights: diffDays(b.check_in, b.check_out!), clash: false }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  // Two stays clash when a night belongs to both (back-to-back is fine).
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length && all[j].from < all[i].to; j++) {
      all[i].clash = true;
      all[j].clash = true;
    }
  return all.filter((s) => s.from < afterLast && s.to >= first);
}

/** Income of a property in that month that has no departure date, so no nights to draw. */
export function undated(data: Data, propertyId: ID, month: Month): Booking[] {
  return data.bookings.filter((b) => b.property_id === propertyId && (!b.check_out || diffDays(b.check_in, b.check_out) <= 0) && b.check_in.startsWith(month));
}

/** Nights of the month that are booked, and how many there are. */
export function bookedNights(stays: Stay[], month: Month): { booked: number; available: number } {
  const nights = new Set<ISODate>();
  for (const s of stays)
    for (let i = 0; i < s.nights; i++) {
      const night = addDays(s.from, i);
      if (night.startsWith(month)) nights.add(night);
    }
  return { booked: nights.size, available: daysInMonth(month) };
}

/** Weeks of a month, Monday first, padded with the neighbouring months' days. */
export function weeksOf(month: Month): ISODate[][] {
  const first = dateInMonth(month, 1);
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  let day = addDays(first, -weekday);
  const last = dateInMonth(month, daysInMonth(month));
  const weeks: ISODate[][] = [];
  while (day <= last) {
    const week: ISODate[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export interface Segment {
  stay: Stay;
  /** Horizontal start and end in day units from the row's first day (0…days). */
  start: number;
  end: number;
  /** The stay began before this row / goes on after it. */
  cutStart: boolean;
  cutEnd: boolean;
  /** 0 for most stays; overlapping (clashing) stays go on further lanes. */
  lane: number;
}

/**
 * The part of each stay that falls in a row of consecutive days (a week, or a
 * month in the timeline). Arrival and departure sit at the middle of their day.
 */
export function segments(days: ISODate[], stays: Stay[]): Segment[] {
  const first = days[0];
  const span = days.length;
  const out: Segment[] = [];
  for (const stay of stays) {
    const a = diffDays(first, stay.from) + 0.5;
    const b = diffDays(first, stay.to) + 0.5;
    if (b <= 0 || a >= span) continue;
    out.push({ stay, start: Math.max(0, a), end: Math.min(span, b), cutStart: a < 0, cutEnd: b > span, lane: 0 });
  }
  // Lanes: a segment goes on the first lane where it does not overlap.
  const lanes: number[] = [];
  for (const s of out.sort((x, y) => x.start - y.start)) {
    let lane = lanes.findIndex((end) => end <= s.start);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = s.end;
    s.lane = lane;
  }
  return out;
}
