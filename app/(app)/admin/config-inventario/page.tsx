import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { inventoryWarehouses, inventorySettings } from '@/lib/db/schema';
import { ConfigInventarioClient } from './config-client';

export default async function ConfigInventarioPage() {
  const session = await getSession();
  if (!session)                 redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const warehouses = db.select().from(inventoryWarehouses).all();
  const settingsRow = db.select().from(inventorySettings).get();

  return (
    <ConfigInventarioClient
      initialWarehouses={warehouses}
      initialSettings={settingsRow ?? { id: 0, rollingWindowDays: 60, daysOfStockThreshold: 7 }}
    />
  );
}
