// lib/pricing/http.ts
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/mssql';
import { getDb } from '@/lib/db/sqlite';
import type { SessionPayload } from '@/lib/auth/session';
import { ConflictError, NotFoundError, ValidationError, type Actor, type ServiceDeps } from './segments-service';
import { realSegmentErp } from './segment-erp';
import { realRatesErp } from './rates-erp-adapter';
import type { ListsDeps } from './lists-service';

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
