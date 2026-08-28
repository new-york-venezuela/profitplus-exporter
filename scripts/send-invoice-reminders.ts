import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { EmailService } from '@/lib/services/email-service';
import { getInvoiceReminderData } from '@/lib/invoice-reminders/repository';
import { InvoiceReminderService } from '@/lib/invoice-reminders/reminder-service';

async function main() {
  const pool = await getPool();
  try {
    const db = getDb();
    const emailService = new EmailService();

    const service = new InvoiceReminderService(getInvoiceReminderData, emailService, db, pool);
    const summary = await service.run();

    console.log(
      `[send-invoice-reminders] ${new Date().toISOString()} — ` +
      `sent=${summary.sent} failed=${summary.failed} total=${summary.total}`
    );

    if (summary.failed > 0) {
      console.warn(`[send-invoice-reminders] ${summary.failed} customer(s) failed — see invoice_reminder_log for details`);
    }
  } finally {
    await pool.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[send-invoice-reminders] fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
