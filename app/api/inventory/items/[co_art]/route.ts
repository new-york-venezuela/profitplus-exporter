import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getSessionFromRequest, hasInventoryAccess } from '@/lib/inventory/access';
import { getDb } from '@/lib/db/sqlite';
import { getPool } from '@/lib/db/mssql';
import { EDITABLE_ITEM_FIELDS, isEditableItemField, isNumericItemField, ITEM_FIELD_MAX_LEN } from '@/lib/inventory/item-fields';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ co_art: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDb();
  const allowed = await hasInventoryAccess(db, session.sub, session.role);
  if (!allowed) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

  const { co_art } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const fields = Object.keys(body);
  if (fields.length === 0) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const invalidFieldIndex = fields.findIndex(f => !isEditableItemField(f));
  if (invalidFieldIndex !== -1) {
    return NextResponse.json({ error: `Campo no editable: ${fields[invalidFieldIndex]}` }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const req = pool.request();
    req.input('coArt', sql.Char(30), co_art);

    const setClauses: string[] = [];
    for (const field of fields as (typeof EDITABLE_ITEM_FIELDS)[number][]) {
      const value = body[field];
      if (isNumericItemField(field)) {
        if (typeof value !== 'number' || !isFinite(value)) {
          return NextResponse.json({ error: `Valor inválido para ${field}` }, { status: 400 });
        }
        req.input(field, sql.Decimal(18, 5), value);
      } else {
        if (value !== null && typeof value !== 'string') {
          return NextResponse.json({ error: `Valor inválido para ${field}` }, { status: 400 });
        }
        const maxLen = ITEM_FIELD_MAX_LEN[field];
        if (value !== null && maxLen !== -1 && value.length > maxLen) {
          return NextResponse.json({ error: `Valor demasiado largo para ${field} (máximo ${maxLen} caracteres)` }, { status: 400 });
        }
        req.input(field, maxLen === -1 ? sql.VarChar(sql.MAX) : sql.VarChar(maxLen), value);
      }
      setClauses.push(`${field} = @${field}`);
    }

    const result = await req.query(
      `UPDATE saArticulo SET ${setClauses.join(', ')} WHERE co_art = @coArt AND anulado = 0`,
    );
    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // SQL Server error 547 = constraint violation (e.g. CK_saArticulo_Stock's
    // stock_min <= stock_max) — a real, reachable validation case, not a
    // server fault, so it gets a 400 with the DB's own message.
    if (typeof error === 'object' && error !== null && 'number' in error && error.number === 547) {
      const message = 'message' in error && typeof error.message === 'string' ? error.message : 'Restricción de datos violada';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Inventory item update error:', error);
    return NextResponse.json({ error: 'Error al actualizar en Profit Plus' }, { status: 500 });
  }
}
