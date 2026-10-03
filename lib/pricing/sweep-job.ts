import type { AppDb } from '@/lib/geo/routes-repo';
import { sendDigest } from './digest';
import { getAlertSettings, recordSweepRun } from './health-repo';
import { loadHealthReport, type HealthErp } from './health-loader';
import { runSweep, type SweepErp, type SweepSummary } from './sweep';

export interface SweepJobDeps {
  sweep: { erp: SweepErp; db: AppDb };
  healthErp: HealthErp;
  db: AppDb;
  email: { send(to: string, template: string, data: Record<string, unknown>): Promise<void> };
  now?: () => Date;
}
export interface SweepJobResult {
  summary: SweepSummary | null;
  sweepError: string | null;
  digest: Awaited<ReturnType<typeof sendDigest>> | null;
  digestError: string | null;
  exitCode: 0 | 1;
}

/**
 * Nightly job: sweep, then ALWAYS the heartbeat (also when the sweep throws), then the digest. A digest problem
 * (health read or any send) only flips the exit code; it never undoes or skips the heartbeat.
 */
export async function runSweepJob(deps: SweepJobDeps, actor: { id: string; erpUser: string }): Promise<SweepJobResult> {
  const now = deps.now ?? (() => new Date());
  let summary: SweepSummary | null = null;
  let sweepError: string | null = null;
  try {
    summary = await runSweep({ ...deps.sweep, now }, actor);
  } catch (error) {
    sweepError = error instanceof Error ? error.message : String(error);
  }

  recordSweepRun(deps.db, {
    runAt: now().getTime(),
    ok: sweepError === null,
    moved: summary?.moved ?? 0,
    failed: summary?.failed ?? 0,
    error: sweepError,
  });

  let digest: SweepJobResult['digest'] = null;
  let digestError: string | null = null;
  try {
    const report = await loadHealthReport({ erp: deps.healthErp, db: deps.db, now }, getAlertSettings(deps.db).daysAhead);
    digest = await sendDigest({ db: deps.db, email: deps.email, now }, report, summary);
  } catch (error) {
    digestError = error instanceof Error ? error.message : String(error);
  }

  const failed = sweepError !== null || (summary?.failed ?? 0) > 0 || digestError !== null || (digest?.failed ?? 0) > 0;
  return { summary, sweepError, digest, digestError, exitCode: failed ? 1 : 0 };
}
