import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings, invoiceReminderLog } from '@/lib/db/schema';
import { ConfigCobranzaClient } from './config-client';

export default async function ConfigCobranzaPage() {
  const session = await getSession();
  if (!session)                 redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const settingsRow = db.select().from(invoiceReminderSettings).get();

  const latestLogRow = db.select().from(invoiceReminderLog)
    .orderBy(desc(invoiceReminderLog.sentAt)).limit(1).get();

  let lastRun = null;
  if (latestLogRow) {
    const runRows = db.select().from(invoiceReminderLog)
      .where(eq(invoiceReminderLog.runDate, latestLogRow.runDate)).all();
    lastRun = {
      runDate: latestLogRow.runDate,
      sentAt:  Math.max(...runRows.map(r => r.sentAt)),
      sent:    runRows.filter(r => r.status === 'sent').length,
      failed:  runRows.filter(r => r.status === 'failed').length,
    };
  }

  return (
    <ConfigCobranzaClient
      initialSettings={settingsRow ?? { id: 0, thresholdDays: 3 }}
      lastRun={lastRun}
    />
  );
}
