// lib/pricing/http.ts
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';
import { ConflictError, NotFoundError, ValidationError, type Actor, type ServiceDeps } from './segments-service';
import { realSegmentErp } from './segment-erp';
import { realRatesErp } from './rates-erp-adapter';
import type { ListsDeps } from './lists-service';
import type { PromotionsDeps } from './promotions-service';
import { requirePricingAccess, type PricingAccessLevel, type PricingAccessResult } from './access';
import { realHealthErp, type HealthErp } from './health-loader';
import type { AppDb } from '@/lib/geo/routes-repo';

export function serviceErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof NotFoundError || error instanceof ConflictError || error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function buildDeps(): Promise<ServiceDeps> {
  return { erp: realSegmentErp(await getPool()), db: getDb() };
}

export function actorFrom(session: SessionPayload): Actor {
  return { id: session.sub, erpUser: process.env.PRICING_ERP_SERVICE_USER ?? 'PROFIT' };
}

export async function buildListsDeps(): Promise<ListsDeps> {
  return { erp: realRatesErp(await getPool()), db: getDb() };
}

export async function buildPromotionsDeps(): Promise<PromotionsDeps> {
  const pool = await getPool();
  return { rates: realRatesErp(pool), segments: realSegmentErp(pool), db: getDb() };
}

export async function buildHealthDeps(): Promise<{ erp: HealthErp; db: AppDb }> {
  return { erp: realHealthErp(await getPool()), db: getDb() };
}

export function isAdminSession(session: SessionPayload): boolean {
  return session.role === 'admin';
}

/** A pricing_edit grant is not enough for admin-only resources: only the admin role passes. */
export function decideAdmin(_level: PricingAccessLevel, role: SessionPayload['role']): 'ok' | 'forbidden' {
  return role === 'admin' ? 'ok' : 'forbidden';
}

export async function requirePricingAdmin(request: NextRequest): Promise<PricingAccessResult> {
  const auth = await requirePricingAccess(request, 'view');
  if (!auth.ok) return auth;
  if (!isAdminSession(auth.session)) {
    return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
  }
  return auth;
}
