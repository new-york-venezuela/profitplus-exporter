import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import { EmailService } from '@/lib/services/email-service';
import { realHealthErp } from '@/lib/pricing/health-loader';
import { runSweepJob } from '@/lib/pricing/sweep-job';
import { realSweepErp } from '@/lib/pricing/sweep-erp';

const TAG = '[pricing:sweep-promotions]';

async function main() {
  let pool: Awaited<ReturnType<typeof getPool>> | null = null;
  try {
    const db = getDb();
    // Pool acquired inside the job so an unreachable ERP still records a failed heartbeat.
    const connectErp = async () => {
      pool = await getPool();
      return { sweepErp: realSweepErp(pool), healthErp: realHealthErp(pool) };
    };
    const r = await runSweepJob(
      { sweep: { db }, connectErp, db, email: new EmailService() },
      { id: 'sweep', erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' },
    );
    if (r.summary) {
      const s = r.summary;
      console.log(`${TAG} ${new Date().toISOString()} — segments=${s.segmentsChecked} moved=${s.moved} skipped=${s.skipped} failed=${s.failed}`);
      for (const e of s.errors) console.warn(`${TAG} ${e}`);
    }
    if (r.sweepError) console.error(`${TAG} sweep failed:`, r.sweepError);
    if (r.digest) console.log(`${TAG} digest sent=${r.digest.sent} failed=${r.digest.failed} skipped=${r.digest.skipped ?? 'none'}`);
    if (r.digestError) console.error(`${TAG} digest error:`, r.digestError);
    if (r.exitCode !== 0) process.exitCode = 1;
  } finally {
    await (pool as Awaited<ReturnType<typeof getPool>> | null)?.close();
  }
}
main().catch(err => { console.error(`${TAG} fatal error:`, err instanceof Error ? err.message : err); process.exit(1); });
