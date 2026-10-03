import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import type { AppDb } from '@/lib/geo/routes-repo';
import type { HealthReport } from './health-loader';
import type { SweepSummary } from './sweep';
import { todayIso } from './dates';
import { getAlertSettings, hasAlertBeenSent, logAlertSent } from './health-repo';

export interface DigestSection { title: string; lines: string[] }
type AlertKind = 'ending_first' | 'ending_last';
export interface Digest {
  isEmpty: boolean;
  sections: DigestSection[];
  toLog: { promotionId: number; kind: AlertKind }[];
  subjectData: { today: string };
}

const MAX_LAPSED_LINES = 20;

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function whenText(daysLeft: number): string {
  if (daysLeft <= 0) return 'termina hoy';
  if (daysLeft === 1) return 'termina mañana';
  return `termina en ${daysLeft} días`;
}

export function composeDigest(
  report: HealthReport,
  opts: {
    daysAhead: number;
    hasBeenSent(promotionId: number, kind: AlertKind): boolean;
    sweepSummary: SweepSummary | null;
  },
): Digest {
  const sections: DigestSection[] = [];
  const toLog: Digest['toLog'] = [];

  const endingLines: string[] = [];
  for (const i of report.endingSoon) {
    const first = i.daysLeft <= opts.daysAhead && !opts.hasBeenSent(i.promotionId, 'ending_first');
    const last = i.daysLeft <= 1 && !opts.hasBeenSent(i.promotionId, 'ending_last');
    if (first) toLog.push({ promotionId: i.promotionId, kind: 'ending_first' });
    if (last) toLog.push({ promotionId: i.promotionId, kind: 'ending_last' });
    if (first || last) endingLines.push(`«${i.name}» ${whenText(i.daysLeft)} (${ddmm(i.endsOn)})`);
  }
  if (endingLines.length > 0) sections.push({ title: 'Terminan pronto', lines: endingLines });

  const sweepLines: string[] = [];
  const sw = report.sweep;
  if (sw.state === 'never') sweepLines.push('El barrido nocturno nunca se ha ejecutado.');
  else if (sw.state === 'stale') sweepLines.push(`El barrido nocturno no corre desde hace ${sw.hoursSince} horas.`);
  else if (sw.state === 'failed') {
    sweepLines.push(`El último barrido nocturno falló${sw.error ? `: ${sw.error}` : sw.failed > 0 ? ` (${sw.failed} con error)` : ''}.`);
  }
  const failedNow = opts.sweepSummary?.failed ?? 0;
  if (failedNow > 0) {
    sweepLines.push(`Este barrido tuvo ${failedNow} ${plural(failedNow, 'segmento con error', 'segmentos con error')}.`);
  }
  if (sweepLines.length > 0) sections.push({ title: 'Fallos del barrido', lines: sweepLines });

  if (report.stranded.length > 0) {
    sections.push({
      title: 'Promociones terminadas con precios aún vigentes',
      lines: report.stranded.map(s =>
        `«${s.name}» terminó el ${ddmm(s.endsOn)} y ${s.itemCount} ${plural(s.itemCount, 'precio sigue', 'precios siguen')} vigente${s.itemCount === 1 ? '' : 's'}`),
    });
  }

  if (report.unreverted.length > 0) {
    sections.push({
      title: 'Vencidas sin revertir',
      lines: report.unreverted.map(u =>
        `«${u.label}»: ${u.customerCount} ${plural(u.customerCount, 'cliente sigue', 'clientes siguen')} en el segmento (venció hace ${u.daysOverdue} ${plural(u.daysOverdue, 'día', 'días')})`),
    });
  }

  if (report.lapsed.length > 0) {
    const lines = report.lapsed.slice(0, MAX_LAPSED_LINES).map(l =>
      `Lista ${l.coPrecio} · artículo ${l.coArt} sin precio${l.lastHasta ? ` desde ${ddmm(l.lastHasta)}` : ''}`);
    if (report.lapsed.length > MAX_LAPSED_LINES) lines.push(`y ${report.lapsed.length - MAX_LAPSED_LINES} más…`);
    sections.push({ title: 'Sin precio vigente', lines });
  }

  return { isEmpty: sections.length === 0, sections, toLog, subjectData: { today: report.today } };
}

export function resolveRecipients(db: AppDb, settings: { recipients: string[] | null }): string[] {
  const norm = (e: string) => e.trim().toLowerCase();
  const explicit = (settings.recipients ?? []).map(norm).filter(e => e.length > 0);
  if (explicit.length > 0) return [...new Set(explicit)];

  const admins = db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.role, 'admin')).all();
  const editors = db.select({ email: schema.users.email }).from(schema.users)
    .innerJoin(schema.userModules, eq(schema.userModules.userId, schema.users.id))
    .where(eq(schema.userModules.module, 'pricing_edit')).all();
  const all = [...admins, ...editors].map(r => norm(r.email)).filter(e => e.length > 0);
  return [...new Set(all)];
}

export async function sendDigest(
  deps: {
    db: AppDb;
    email: { send(to: string, template: string, data: Record<string, unknown>): Promise<void> };
    now?: () => Date;
  },
  report: HealthReport,
  sweepSummary: SweepSummary | null,
): Promise<{ sent: number; failed: number; skipped: 'disabled' | 'empty' | 'no-recipients' | null }> {
  const settings = getAlertSettings(deps.db);
  if (!settings.enabled) return { sent: 0, failed: 0, skipped: 'disabled' };

  const digest = composeDigest(report, {
    daysAhead: settings.daysAhead,
    hasBeenSent: (id, kind) => hasAlertBeenSent(deps.db, id, kind),
    sweepSummary,
  });
  if (digest.isEmpty) return { sent: 0, failed: 0, skipped: 'empty' };

  const recipients = resolveRecipients(deps.db, settings);
  if (recipients.length === 0) return { sent: 0, failed: 0, skipped: 'no-recipients' };

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      await deps.email.send(to, 'pricing-expiry-digest', { today: digest.subjectData.today, sections: digest.sections });
      sent++;
    } catch (error) {
      failed++;
      console.error(`[pricing:digest] failed to send to ${to}:`, error instanceof Error ? error.message : error);
    }
  }

  // Only when someone got it: otherwise the notices stay unlogged and are retried on the next run.
  if (sent > 0) {
    const sentOn = todayIso((deps.now ?? (() => new Date()))());
    for (const l of digest.toLog) logAlertSent(deps.db, l.promotionId, l.kind, sentOn);
  }
  return { sent, failed, skipped: null };
}
