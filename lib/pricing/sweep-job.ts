import type { AppDb } from '@/lib/geo/routes-repo';
import { sendDigest } from './digest';
import { sweepStatus } from './health';
import { todayIso } from './dates';
import { getAlertSettings, getLastSweepRun, recordSweepRun } from './health-repo';
import { loadHealthReport, type HealthErp, type HealthReport } from './health-loader';
import { runSweep, type SweepErp, type SweepSummary } from './sweep';

export interface SweepJobDeps {
  sweep: { erp?: SweepErp; db: AppDb };
  healthErp?: HealthErp;
  /** Lazy ERP acquisition: a failure here (e.g. unreachable server) is a sweep failure, still heartbeated. */
  connectErp?: () => Promise<{ sweepErp: SweepErp; healthErp: HealthErp }>;
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

/** Report with only the ERP-free part (sweep heartbeat); used when the health read fails. */
function reducedReport(db: AppDb, now: () => Date): HealthReport {
  const d = now();
  const last = getLastSweepRun(db);
  return {
    today: todayIso(d), withinDays: getAlertSettings(db).daysAhead, endingSoon: [], unreverted: [], lapsed: [], stranded: [],
    sweep: sweepStatus(last && { runAt: last.runAt, ok: last.ok === 1, failed: last.failed, error: last.error }, d.getTime()),
  };
}

/**
 * Nightly job: sweep, then ALWAYS the heartbeat (also when the sweep throws), then the digest. A digest problem
 * (health read or any send) only flips the exit code; it never undoes or skips the heartbeat.
 */
export async function runSweepJob(deps: SweepJobDeps, actor: { id: string; erpUser: string }): Promise<SweepJobResult> {
  const now = deps.now ?? (() => new Date());
  let summary: SweepSummary | null = null;
  let sweepError: string | null = null;
  let sweepErp = deps.sweep.erp;
  let healthErp = deps.healthErp;
  try {
    if (deps.connectErp) ({ sweepErp, healthErp } = await deps.connectErp());
    if (!sweepErp) throw new Error('No ERP connection configured');
    summary = await runSweep({ db: deps.sweep.db, erp: sweepErp, now }, actor);
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
  let report: HealthReport | null = null;
  try {
    if (!healthErp) throw new Error('No ERP connection configured');
    report = await loadHealthReport({ erp: healthErp, db: deps.db, now }, getAlertSettings(deps.db).daysAhead);
  } catch (error) {
    digestError = error instanceof Error ? error.message : String(error);
    // The sweep-failure section needs no ERP data, so still tell people when the sweep itself failed.
    if (sweepError !== null || (summary?.failed ?? 0) > 0) report = reducedReport(deps.db, now);
  }
  if (report) {
    try {
      digest = await sendDigest({ db: deps.db, email: deps.email, now }, report, summary);
    } catch (error) {
      digestError ??= error instanceof Error ? error.message : String(error);
    }
  }

  const failed = sweepError !== null || (summary?.failed ?? 0) > 0 || digestError !== null || (digest?.failed ?? 0) > 0;
  return { summary, sweepError, digest, digestError, exitCode: failed ? 1 : 0 };
}
