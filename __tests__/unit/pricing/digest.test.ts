import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';
import { makeMemoryDb } from '../../helpers/memory-db';
import { composeDigest, resolveRecipients, sendDigest } from '@/lib/pricing/digest';
import { getAlertSettings, hasAlertBeenSent, saveAlertSettings } from '@/lib/pricing/health-repo';
import type { HealthReport } from '@/lib/pricing/health-loader';
import type { SweepSummary } from '@/lib/pricing/sweep';
import * as schema from '@/lib/db/schema';

const okSweep = { state: 'ok' as const, lastRunAt: 1, hoursSince: 5, failed: 0, error: null };
function report(over: Partial<HealthReport> = {}): HealthReport {
  return { today: '2026-10-01', withinDays: 7, endingSoon: [], unreverted: [], lapsed: [], stranded: [], sweep: okSweep, ...over };
}
const ending = (promotionId: number, daysLeft: number, name = 'Promo') => ({
  promotionId, name, kind: 'overlay' as const, endsOn: '2026-10-05', daysLeft, coPrecio: '08',
});
const never = () => false;
const summary = (failed: number): SweepSummary => ({ segmentsChecked: 1, moved: 0, skipped: 0, failed, errors: [] });

describe('composeDigest', () => {
  test('ending_first fires once at daysLeft <= daysAhead, and not again once sent', () => {
    const r = report({ endingSoon: [ending(1, 5)] });
    const d1 = composeDigest(r, { daysAhead: 7, hasBeenSent: never, sweepSummary: null });
    expect(d1.toLog).toEqual([{ promotionId: 1, kind: 'ending_first' }]);
    expect(d1.sections[0].lines[0]).toContain('termina en 5 días (05/10)');
    const d2 = composeDigest(r, { daysAhead: 7, hasBeenSent: () => true, sweepSummary: null });
    expect(d2.isEmpty).toBe(true);
    expect(d2.toLog).toEqual([]);
  });

  test('a missed day still fires (daysLeft 6, no prior log, daysAhead 7)', () => {
    const d = composeDigest(report({ endingSoon: [ending(1, 6)] }), { daysAhead: 7, hasBeenSent: never, sweepSummary: null });
    expect(d.toLog).toEqual([{ promotionId: 1, kind: 'ending_first' }]);
  });

  test('beyond daysAhead nothing fires', () => {
    const d = composeDigest(report({ endingSoon: [ending(1, 8)] }), { daysAhead: 7, hasBeenSent: never, sweepSummary: null });
    expect(d.isEmpty).toBe(true);
  });

  test('daysLeft 1 logs both kinds but lists the promotion once, as mañana', () => {
    const d = composeDigest(report({ endingSoon: [ending(1, 1)] }), { daysAhead: 7, hasBeenSent: never, sweepSummary: null });
    expect(d.toLog).toEqual([{ promotionId: 1, kind: 'ending_first' }, { promotionId: 1, kind: 'ending_last' }]);
    expect(d.sections[0].lines).toHaveLength(1);
    expect(d.sections[0].lines[0]).toContain('termina mañana');
  });

  test('ending_last still fires at 1 day when only ending_first was sent', () => {
    const d = composeDigest(report({ endingSoon: [ending(1, 1)] }), {
      daysAhead: 7, hasBeenSent: (_id, kind) => kind === 'ending_first', sweepSummary: null,
    });
    expect(d.toLog).toEqual([{ promotionId: 1, kind: 'ending_last' }]);
  });

  test('sweep never/stale/failed produce the failure section; ok produces none', () => {
    const opts = { daysAhead: 7, hasBeenSent: never, sweepSummary: null };
    for (const state of ['never', 'stale', 'failed'] as const) {
      const d = composeDigest(report({ sweep: { ...okSweep, state, error: state === 'failed' ? 'boom' : null } }), opts);
      expect(d.sections.map(s => s.title)).toEqual(['Fallos del barrido']);
    }
    expect(composeDigest(report({ sweep: { ...okSweep, state: 'failed', error: 'boom' } }), opts).sections[0].lines[0]).toContain('boom');
    expect(composeDigest(report(), opts).isEmpty).toBe(true);
  });

  test('sweepSummary.failed adds a line', () => {
    const d = composeDigest(report(), { daysAhead: 7, hasBeenSent: never, sweepSummary: summary(2) });
    expect(d.sections[0].lines.join()).toContain('2 clientes con error');
    expect(d.sections[0].lines.join()).not.toContain('segmentos');
    expect(composeDigest(report(), { daysAhead: 7, hasBeenSent: never, sweepSummary: summary(0) }).isEmpty).toBe(true);
  });

  test('a failed heartbeat with failed customers is reported once, in clientes', () => {
    const r = report({ sweep: { ...okSweep, state: 'failed', failed: 2 } });
    const d = composeDigest(r, { daysAhead: 7, hasBeenSent: never, sweepSummary: summary(2) });
    expect(d.sections[0].lines).toEqual(['Este barrido tuvo 2 clientes con error.']);
  });

  test('unreverted and stranded sections', () => {
    const d = composeDigest(report({
      unreverted: [{ tipCli: 'S1', label: 'Cliente X', expiresAt: '2026-09-28', daysOverdue: 3, customerCount: 2 }],
      stranded: [{ promotionId: 9, name: 'Vieja', endsOn: '2026-09-20', itemCount: 1 }],
    }), { daysAhead: 7, hasBeenSent: never, sweepSummary: null });
    expect(d.sections.map(s => s.title)).toEqual(['Promociones terminadas con precios aún vigentes', 'Vencidas sin revertir']);
    expect(d.sections[1].lines[0]).toBe('«Cliente X»: 2 clientes siguen en el segmento (venció hace 3 días)');
  });

  test('lapsed list capped at 20 lines plus "y N más…"', () => {
    const lapsed = Array.from({ length: 25 }, (_, i) => ({
      coPrecio: '08', coArt: `A${i}`, coAlma: '1', lastHasta: '2026-09-30', nextDesde: null,
    }));
    const d = composeDigest(report({ lapsed }), { daysAhead: 7, hasBeenSent: never, sweepSummary: null });
    const lines = d.sections[0].lines;
    expect(lines).toHaveLength(21);
    expect(lines[0]).toBe('Lista 08 · artículo A0 sin precio desde 30/09');
    expect(lines[20]).toBe('y 5 más…');
  });
});

function seedUsers(db: ReturnType<typeof makeMemoryDb>) {
  const add = (email: string, role: 'user' | 'admin', mods: string[]) => {
    const u = db.insert(schema.users).values({ email, name: email, passwordHash: 'x', role, createdAt: 1 }).returning({ id: schema.users.id }).get()!;
    for (const m of mods) db.insert(schema.userModules).values({ userId: u.id, module: m as 'pricing_edit' }).run();
  };
  add('Admin@x.com', 'admin', []);
  add('editor@x.com', 'user', ['pricing_edit']);
  add('viewer@x.com', 'user', ['pricing_view']);
  add('admin-editor@x.com', 'admin', ['pricing_edit']);
  add('', 'admin', []);
}

describe('resolveRecipients', () => {
  test('explicit list wins', () => {
    const db = makeMemoryDb();
    seedUsers(db);
    expect(resolveRecipients(db, { recipients: ['A@x.com', 'a@x.com', 'b@x.com'] })).toEqual(['a@x.com', 'b@x.com']);
  });
  test('default = admins + pricing_edit, no empty emails, no view-only, de-duplicated', () => {
    const db = makeMemoryDb();
    seedUsers(db);
    expect(resolveRecipients(db, { recipients: null }).sort()).toEqual(['admin-editor@x.com', 'admin@x.com', 'editor@x.com']);
    expect(resolveRecipients(db, { recipients: [] }).sort()).toEqual(['admin-editor@x.com', 'admin@x.com', 'editor@x.com']);
  });
});

describe('sendDigest', () => {
  const NOW = () => new Date(2026, 9, 1, 12);
  const live = () => report({ endingSoon: [ending(1, 3)] });
  function mailer(failFor: string[] = []) {
    const calls: { to: string; template: string; data: Record<string, unknown> }[] = [];
    return {
      calls,
      email: {
        send: async (to: string, template: string, data: Record<string, unknown>) => {
          calls.push({ to, template, data });
          if (failFor.includes(to)) throw new Error('smtp down');
        },
      },
    };
  }
  const setup = (recipients: string[] | null = ['a@x.com', 'b@x.com']) => {
    const db = makeMemoryDb();
    saveAlertSettings(db, { enabled: true, daysAhead: 7, recipients });
    return db;
  };

  test('disabled sends nothing', async () => {
    const db = setup();
    saveAlertSettings(db, { enabled: false, daysAhead: 7, recipients: ['a@x.com'] });
    const m = mailer();
    expect(await sendDigest({ db, email: m.email, now: NOW }, live(), null)).toEqual({ sent: 0, failed: 0, skipped: 'disabled' });
    expect(m.calls).toHaveLength(0);
  });

  test('empty sends nothing and logs nothing', async () => {
    const db = setup();
    const m = mailer();
    expect(await sendDigest({ db, email: m.email, now: NOW }, report(), null)).toEqual({ sent: 0, failed: 0, skipped: 'empty' });
    expect(m.calls).toHaveLength(0);
    expect(db.select().from(schema.pricingAlertLog).all()).toHaveLength(0);
  });

  test('no recipients is reported and nothing logged', async () => {
    const db = setup(null);
    const m = mailer();
    expect(await sendDigest({ db, email: m.email, now: NOW }, live(), null)).toEqual({ sent: 0, failed: 0, skipped: 'no-recipients' });
    expect(db.select().from(schema.pricingAlertLog).all()).toHaveLength(0);
  });

  test('sends to every recipient, logs the alert, and never double-sends the next run', async () => {
    const db = setup();
    const m = mailer();
    const r = await sendDigest({ db, email: m.email, now: NOW }, live(), null);
    expect(r).toEqual({ sent: 2, failed: 0, skipped: null });
    expect(m.calls[0].template).toBe('pricing-expiry-digest');
    expect(m.calls[0].data.today).toBe('2026-10-01');
    expect(hasAlertBeenSent(db, 1, 'ending_first')).toBe(true);
    const again = await sendDigest({ db, email: m.email, now: NOW }, live(), null);
    expect(again.skipped).toBe('empty');
    expect(m.calls).toHaveLength(2);
  });

  test('first recipient throws: second still gets it, alerts are logged', async () => {
    const db = setup();
    const m = mailer(['a@x.com']);
    expect(await sendDigest({ db, email: m.email, now: NOW }, live(), null)).toEqual({ sent: 1, failed: 1, skipped: null });
    expect(m.calls).toHaveLength(2);
    expect(hasAlertBeenSent(db, 1, 'ending_first')).toBe(true);
  });

  test('all sends fail: alerts are not logged so they retry tomorrow', async () => {
    const db = setup();
    const m = mailer(['a@x.com', 'b@x.com']);
    expect(await sendDigest({ db, email: m.email, now: NOW }, live(), null)).toEqual({ sent: 0, failed: 2, skipped: null });
    expect(hasAlertBeenSent(db, 1, 'ending_first')).toBe(false);
    expect(getAlertSettings(db).enabled).toBe(true);
  });
});

describe('pricing-expiry-digest.hbs', () => {
  const tpl = Handlebars.compile(fs.readFileSync('lib/email/templates/pricing-expiry-digest.hbs', 'utf-8'));
  test('renders title, section and lines, and escapes HTML', () => {
    const html = tpl({
      today: '2026-10-01',
      sections: [{ title: 'Terminan pronto', lines: ['«<script>alert(1)</script>» termina mañana (02/10)'] }],
    });
    expect(html).toContain('Resumen de vencimientos de precios — 2026-10-01');
    expect(html).toContain('Terminan pronto');
    expect(html).toContain('termina mañana (02/10)');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('solo cuando hay algo que revisar');
  });
});
