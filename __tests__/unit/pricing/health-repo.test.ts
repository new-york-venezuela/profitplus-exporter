import { describe, test, expect } from 'bun:test';
import { sql } from 'drizzle-orm';
import { makeMemoryDb } from '../../helpers/memory-db';
import {
  getAlertSettings, getLastSweepRun, hasAlertBeenSent, logAlertSent, recordSweepRun, saveAlertSettings,
} from '@/lib/pricing/health-repo';
import * as schema from '@/lib/db/schema';

describe('alert settings', () => {
  test('defaults on an empty db', () => {
    expect(getAlertSettings(makeMemoryDb())).toEqual({ enabled: true, daysAhead: 7, recipients: null });
  });
  test('round-trips an array and null, and upserts', () => {
    const db = makeMemoryDb();
    saveAlertSettings(db, { enabled: false, daysAhead: 14, recipients: ['a@x.com', 'b@x.com'] });
    expect(getAlertSettings(db)).toEqual({ enabled: false, daysAhead: 14, recipients: ['a@x.com', 'b@x.com'] });
    saveAlertSettings(db, { enabled: true, daysAhead: 3, recipients: null });
    expect(getAlertSettings(db)).toEqual({ enabled: true, daysAhead: 3, recipients: null });
    expect(db.select().from(schema.pricingAlertSettings).all()).toHaveLength(1);
  });
  test('invalid stored JSON reads as null', () => {
    const db = makeMemoryDb();
    saveAlertSettings(db, { enabled: true, daysAhead: 7, recipients: [] });
    db.run(sql`UPDATE pricing_alert_settings SET recipients = 'not json'`);
    expect(getAlertSettings(db).recipients).toBeNull();
  });
});

describe('sweep runs', () => {
  test('no run yet', () => expect(getLastSweepRun(makeMemoryDb())).toBeUndefined());
  test('returns the newest by runAt', () => {
    const db = makeMemoryDb();
    recordSweepRun(db, { runAt: 2000, ok: true, moved: 3, failed: 0 });
    recordSweepRun(db, { runAt: 1000, ok: false, moved: 0, failed: 1, error: 'old' });
    expect(getLastSweepRun(db)).toMatchObject({ runAt: 2000, ok: 1, moved: 3, failed: 0, error: null });
  });
  test('stores the error text', () => {
    const db = makeMemoryDb();
    recordSweepRun(db, { runAt: 1, ok: false, moved: 0, failed: 0, error: 'boom' });
    expect(getLastSweepRun(db)).toMatchObject({ ok: 0, error: 'boom' });
  });
});

describe('alert log', () => {
  test('idempotent per (promotion, kind); kinds independent', () => {
    const db = makeMemoryDb();
    expect(hasAlertBeenSent(db, 1, 'ending_first')).toBe(false);
    logAlertSent(db, 1, 'ending_first', '2026-10-01');
    logAlertSent(db, 1, 'ending_first', '2026-10-02');
    expect(hasAlertBeenSent(db, 1, 'ending_first')).toBe(true);
    expect(hasAlertBeenSent(db, 1, 'ending_last')).toBe(false);
    expect(hasAlertBeenSent(db, 2, 'ending_first')).toBe(false);
    expect(db.select().from(schema.pricingAlertLog).all()).toHaveLength(1);
  });
});
