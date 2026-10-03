import { describe, test, expect } from 'bun:test';
import { promoStatusBadge } from '@/app/(app)/pricing/promo-status-badge';

const b = (status: 'scheduled' | 'active' | 'ended' | 'cancelled', daysLeft: number | null, partial = false) =>
  promoStatusBadge({ status, daysLeft, partial });

describe('promoStatusBadge', () => {
  test('scheduled', () => expect(b('scheduled', 12)).toEqual({ label: 'Programada', tone: 'info' }));
  test('active: 0 / 1 / 7 / 8 days', () => {
    expect(b('active', 0)).toEqual({ label: 'Activa · termina hoy', tone: 'warn' });
    expect(b('active', 1)).toEqual({ label: 'Activa · 1 d', tone: 'warn' });
    expect(b('active', 7)).toEqual({ label: 'Activa · 7 d', tone: 'warn' });
    expect(b('active', 8)).toEqual({ label: 'Activa · 8 d', tone: 'ok' });
  });
  test('ended and cancelled are muted', () => {
    expect(b('ended', null)).toEqual({ label: 'Terminada', tone: 'muted' });
    expect(b('cancelled', null)).toEqual({ label: 'Cancelada', tone: 'muted' });
  });
  test('partial appends label and forces warn', () => {
    expect(b('scheduled', 12, true)).toEqual({ label: 'Programada · parcial', tone: 'warn' });
    expect(b('active', 30, true)).toEqual({ label: 'Activa · 30 d · parcial', tone: 'warn' });
  });
  test('partial keeps muted tone for ended/cancelled', () => {
    expect(b('ended', null, true)).toEqual({ label: 'Terminada · parcial', tone: 'muted' });
    expect(b('cancelled', null, true)).toEqual({ label: 'Cancelada · parcial', tone: 'muted' });
  });
});
