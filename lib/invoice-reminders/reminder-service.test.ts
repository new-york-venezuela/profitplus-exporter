process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

import { describe, test, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings, invoiceReminderLog } from '@/lib/db/schema';
import { InvoiceReminderService } from './reminder-service';
import type { CustomerInvoiceGroup } from './types';
import type { EmailService } from '@/lib/services/email-service';

function makeGroup(overrides: Partial<CustomerInvoiceGroup> = {}): CustomerInvoiceGroup {
  return {
    coCli: 'C001', cliDes: 'Cliente Uno', email: 'uno@x.com',
    dueSoon: [], dueToday: [{
      nroDoc: 'B0001', nControl: '00-001', fecVenc: new Date(), saldoBs: 100, saldoUsd: 2, diasVencido: 0,
    }], overdue: [],
    ...overrides,
  };
}

function resetDb() {
  const db = getDb();
  db.delete(invoiceReminderLog).run();
  db.delete(invoiceReminderSettings).run();
  db.insert(invoiceReminderSettings).values({ thresholdDays: 3 }).run();
}

describe('InvoiceReminderService', () => {
  beforeEach(() => {
    resetDb();
  });

  test('sends one email per customer group and logs a sent row each', async () => {
    const groups = [makeGroup({ coCli: 'C001' }), makeGroup({ coCli: 'C002', email: 'dos@x.com' })];
    const sentTo: string[] = [];
    const fakeEmailService = {
      send: async (to: string) => { sentTo.push(to); },
    } as unknown as EmailService;

    const service = new InvoiceReminderService(
      async () => groups,
      fakeEmailService,
      getDb(),
      {} as never, // pool unused when getInvoiceData is faked
    );

    const summary = await service.run();

    expect(summary).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(sentTo.sort()).toEqual(['dos@x.com', 'uno@x.com']);

    const logRows = getDb().select().from(invoiceReminderLog).all();
    expect(logRows).toHaveLength(2);
    expect(logRows.every(r => r.status === 'sent')).toBe(true);
  });

  test('continues past a per-customer send failure and logs it', async () => {
    const groups = [makeGroup({ coCli: 'C001', email: 'fails@x.com' }), makeGroup({ coCli: 'C002', email: 'ok@x.com' })];
    const fakeEmailService = {
      send: async (to: string) => {
        if (to === 'fails@x.com') throw new Error('SMTP down');
      },
    } as unknown as EmailService;

    const service = new InvoiceReminderService(
      async () => groups,
      fakeEmailService,
      getDb(),
      {} as never,
    );

    const summary = await service.run();

    expect(summary).toEqual({ sent: 1, failed: 1, total: 2 });

    const logRows = getDb().select().from(invoiceReminderLog).all();
    const failedRow = logRows.find(r => r.email === 'fails@x.com');
    expect(failedRow?.status).toBe('failed');
    expect(failedRow?.errorMessage).toContain('SMTP down');
    const sentRow = logRows.find(r => r.email === 'ok@x.com');
    expect(sentRow?.status).toBe('sent');
  });

  test('reads thresholdDays from settings and passes it to the repository function', async () => {
    getDb().update(invoiceReminderSettings).set({ thresholdDays: 7 })
      .where(eq(invoiceReminderSettings.id, getDb().select().from(invoiceReminderSettings).get()!.id)).run();

    let receivedThreshold: number | null = null;
    const fakeGetData = async (_pool: unknown, thresholdDays: number) => {
      receivedThreshold = thresholdDays;
      return [];
    };
    const fakeEmailService = { send: async () => {} } as unknown as EmailService;

    const service = new InvoiceReminderService(fakeGetData as never, fakeEmailService, getDb(), {} as never);
    await service.run();

    expect(receivedThreshold as number | null).toBe(7);
  });

  test('empty groups produce a zeroed summary and no log rows', async () => {
    const fakeEmailService = { send: async () => {} } as unknown as EmailService;
    const service = new InvoiceReminderService(async () => [], fakeEmailService, getDb(), {} as never);

    const summary = await service.run();

    expect(summary).toEqual({ sent: 0, failed: 0, total: 0 });
    expect(getDb().select().from(invoiceReminderLog).all()).toHaveLength(0);
  });
});
