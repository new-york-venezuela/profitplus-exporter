import { describe, expect, test } from 'bun:test';
import { prospectWindow, weeksActive } from '../window';

describe('weeksActive', () => {
  test('first invoice on the last day counts one week', () => {
    expect(weeksActive(20260301, 20260301)).toBe(1);
  });
  test('rounds inclusive days up to whole weeks', () => {
    expect(weeksActive(20260210, 20260301)).toBe(3);
    expect(weeksActive(20260223, 20260301)).toBe(1);
    expect(weeksActive(20260222, 20260301)).toBe(2);
  });
  test('never below 1', () => {
    expect(weeksActive(20260305, 20260301)).toBe(1);
  });
});

describe('prospectWindow', () => {
  test('Wednesday: ends the previous Sunday, starts the Monday 83 days earlier', () => {
    // Wed 2026-11-04 -> Sunday 2026-11-01; start Monday 2026-08-10
    expect(prospectWindow(new Date(2026, 10, 4, 15, 0))).toEqual({ startKey: 20260810, endKey: 20261101 });
  });
  test('Sunday: ends the Sunday a week earlier', () => {
    // Sun 2026-11-08 -> Sunday 2026-11-01
    expect(prospectWindow(new Date(2026, 10, 8, 23, 30))).toEqual({ startKey: 20260810, endKey: 20261101 });
  });
  test('Monday: ends yesterday', () => {
    expect(prospectWindow(new Date(2026, 10, 9, 0, 5))).toEqual({ startKey: 20260817, endKey: 20261108 });
  });
});
