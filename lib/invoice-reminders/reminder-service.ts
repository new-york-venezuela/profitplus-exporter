import type sql from 'mssql';
import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { invoiceReminderSettings, invoiceReminderLog } from '@/lib/db/schema';
import type { EmailService } from '@/lib/services/email-service';
import type { CustomerInvoiceGroup, ReminderInvoice } from './types';

export interface RunSummary {
  sent:   number;
  failed: number;
  total:  number;
}

type GetInvoiceData = (pool: sql.ConnectionPool, thresholdDays: number) => Promise<CustomerInvoiceGroup[]>;

function formatInvoice(invoice: ReminderInvoice) {
  return {
    nroDoc:      invoice.nroDoc,
    nControl:    invoice.nControl,
    fecVenc:     invoice.fecVenc.toLocaleDateString('es-VE'),
    saldoBs:     invoice.saldoBs.toFixed(2),
    saldoUsd:    invoice.saldoUsd.toFixed(2),
    diasVencido: invoice.diasVencido,
  };
}

export class InvoiceReminderService {
  constructor(
    private readonly getInvoiceData: GetInvoiceData,
    private readonly emailService: EmailService,
    private readonly db: BunSQLiteDatabase<typeof schema>,
    private readonly pool: sql.ConnectionPool,
  ) {}

  async run(): Promise<RunSummary> {
    const thresholdDays = this.readThresholdDays();
    const groups = await this.getInvoiceData(this.pool, thresholdDays);

    let sent = 0;
    let failed = 0;

    for (const group of groups) {
      const invoiceCount = group.dueSoon.length + group.dueToday.length + group.overdue.length;
      try {
        await this.emailService.send(group.email, 'invoice-reminder', {
          cliDes:   group.cliDes,
          dueSoon:  group.dueSoon.map(formatInvoice),
          dueToday: group.dueToday.map(formatInvoice),
          overdue:  group.overdue.map(formatInvoice),
        });
        this.logResult(group, invoiceCount, 'sent', null);
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logResult(group, invoiceCount, 'failed', message);
        failed++;
      }
    }

    return { sent, failed, total: groups.length };
  }

  private readThresholdDays(): number {
    const row = this.db.select().from(invoiceReminderSettings).get();
    return row?.thresholdDays ?? 3;
  }

  private logResult(
    group: CustomerInvoiceGroup,
    invoiceCount: number,
    status: 'sent' | 'failed',
    errorMessage: string | null,
  ): void {
    const runDate = new Date().toISOString().slice(0, 10);
    this.db.insert(invoiceReminderLog).values({
      runDate,
      coCli:        group.coCli,
      email:        group.email,
      invoiceCount,
      status,
      errorMessage,
      sentAt:       Date.now(),
    }).run();
  }
}
