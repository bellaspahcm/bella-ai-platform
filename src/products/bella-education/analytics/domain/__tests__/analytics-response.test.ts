import { vietnamDate } from '../analytics-response';

it.each([
  ['2026-10-22T16:59:59.000Z', '2026-10-22'],
  ['2026-10-22T17:00:00.000Z', '2026-10-23'],
])('selects the Vietnam business day at %s', (instant, day) => {
  expect(vietnamDate(new Date(instant))).toBe(day);
});
