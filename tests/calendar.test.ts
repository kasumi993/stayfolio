import { describe, expect, it } from 'vitest';

import { bookedNights, segments, staysOf, undated, weeksOf } from '../src/core/calendar';
import { type Booking, type Data, emptyData } from '../src/core/types';

const booking = (id: string, check_in: string, check_out: string | null, property_id = 'p1'): Booking => ({
  id, property_id, platform: 'Airbnb', guest: '', check_in, check_out, received_on: null, currency: 'XOF', amount: 1, fx_rate: 1, commission_rate: null, received_by: null, notes: '', created_at: '',
});
const data = (bookings: Booking[]): Data => ({ ...emptyData(), bookings });

describe('calendar', () => {
  it('lays out November 2026 from Monday 26 October to Sunday 6 December', () => {
    const weeks = weeksOf('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[0][6]).toBe('2026-11-01');
    expect(weeks[5][6]).toBe('2026-12-06');
  });

  it('keeps stays touching the month, counts only its nights, and flags undated income', () => {
    const d = data([booking('a', '2026-10-30', '2026-11-02'), booking('b', '2026-11-28', '2026-12-03'), booking('c', '2026-12-05', '2026-12-07'), booking('d', '2026-11-10', null), booking('e', '2026-11-05', '2026-11-07', 'p2')]);
    const stays = staysOf(d, 'p1', '2026-11');
    expect(stays.map((s) => s.booking.id)).toEqual(['a', 'b']);
    // 1 Nov from "a", 28-30 Nov from "b".
    expect(bookedNights(stays, '2026-11')).toEqual({ booked: 4, available: 30 });
    expect(undated(d, 'p1', '2026-11').map((b) => b.id)).toEqual(['d']);
  });

  it('flags double bookings but not back-to-back stays', () => {
    const d = data([booking('a', '2026-11-01', '2026-11-04'), booking('b', '2026-11-04', '2026-11-06'), booking('c', '2026-11-05', '2026-11-08')]);
    const clash = Object.fromEntries(staysOf(d, 'p1', '2026-11').map((s) => [s.booking.id, s.clash]));
    expect(clash).toEqual({ a: false, b: true, c: true });
  });

  it('draws a stay from the middle of arrival to the middle of departure, cut at the row edges', () => {
    const d = data([booking('a', '2026-11-04', '2026-11-11'), booking('b', '2026-11-11', '2026-11-12'), booking('c', '2026-11-10', '2026-11-12')]);
    const week = weeksOf('2026-11')[2]; // Mon 9 → Sun 15
    const segs = segments(week, staysOf(d, 'p1', '2026-11'));
    const a = segs.find((s) => s.stay.booking.id === 'a')!;
    expect([a.start, a.end, a.cutStart, a.cutEnd]).toEqual([0, 2.5, true, false]);
    const b = segs.find((s) => s.stay.booking.id === 'b')!;
    expect([b.start, b.end]).toEqual([2.5, 3.5]);
    // "c" overlaps both: it goes on a second lane.
    expect(segs.find((s) => s.stay.booking.id === 'c')!.lane).toBe(1);
    expect(b.lane).toBe(0);
  });
});
