import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { invoiceReminderSettings } from '@/lib/db/schema';
import { ConfigCobranzaClient } from './config-client';

export default async function ConfigCobranzaPage() {
  const session = await getSession();
  if (!session)                 redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const settingsRow = db.select().from(invoiceReminderSettings).get();

  return (
    <ConfigCobranzaClient
      initialSettings={settingsRow ?? { id: 0, thresholdDays: 3 }}
    />
  );
}
