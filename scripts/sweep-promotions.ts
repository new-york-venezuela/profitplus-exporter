import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { runSweep } from '@/lib/pricing/sweep';
import { realSweepErp } from '@/lib/pricing/sweep-erp';

async function main() {
  const pool = await getPool();
  try {
    const summary = await runSweep(
      { erp: realSweepErp(pool), db: getDb() },
      { id: 'sweep', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' },
    );
    console.log(`[pricing:sweep-promotions] ${new Date().toISOString()} — segments=${summary.segmentsChecked} moved=${summary.moved} skipped=${summary.skipped} failed=${summary.failed}`);
    for (const e of summary.errors) console.warn(`[pricing:sweep-promotions] ${e}`);
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch(err => { console.error('[pricing:sweep-promotions] fatal error:', err instanceof Error ? err.message : err); process.exit(1); });
