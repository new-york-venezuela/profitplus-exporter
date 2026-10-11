import { describe, test, expect } from 'bun:test';
import {
  DEFAULT_VISIT_FREQUENCY, VISIT_FREQUENCIES, VISIT_INTERVAL_DAYS, parseVisitFrequency, visitIntervalDays,
} from '../../../lib/customer-mapping/frequency';

describe('visit frequency', () => {
  test('enum, default and intervals', () => {
    expect([...VISIT_FREQUENCIES]).toEqual(['SEMANAL', 'QUINCENAL', 'MENSUAL']);
    expect(DEFAULT_VISIT_FREQUENCY).toBe('SEMANAL');
    expect(VISIT_INTERVAL_DAYS).toEqual({ SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 });
  });
  test('parses case-insensitively and trims', () => {
    expect(parseVisitFrequency('Semanal')).toBe('SEMANAL');
    expect(parseVisitFrequency('  quincenal ')).toBe('QUINCENAL');
    expect(parseVisitFrequency('MENSUAL')).toBe('MENSUAL');
  });
  test('blank, null and unknown values are null', () => {
    expect(parseVisitFrequency('')).toBeNull();
    expect(parseVisitFrequency(null)).toBeNull();
    expect(parseVisitFrequency(undefined)).toBeNull();
    expect(parseVisitFrequency('Diaria')).toBeNull();
    expect(parseVisitFrequency('Semánal')).toBeNull(); // accents are not stripped (parity with SQL)
    expect(parseVisitFrequency(7)).toBeNull();
  });
  test('interval days', () => {
    expect(visitIntervalDays('SEMANAL')).toBe(7);
    expect(visitIntervalDays('QUINCENAL')).toBe(15);
    expect(visitIntervalDays('MENSUAL')).toBe(30);
    expect(visitIntervalDays(null)).toBeNull();
    expect(visitIntervalDays(undefined)).toBeNull();
  });
});
