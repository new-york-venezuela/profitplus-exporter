// lib/geo/erp-seller.ts
import sql from 'mssql';
import { CustomerNotFoundError, ERP_USER_CODE } from './erp-location';

export class SellerNotFoundError extends Error {
  constructor(coVen: string) {
    super(`Vendedor ${coVen} no encontrado o inactivo`);
    this.name = 'SellerNotFoundError';
  }
}

// saVendedor.co_ven is char(6); anything longer (after trimming) cannot exist.
export function normalizeCoVen(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  return code.length > 0 && code.length <= 6 ? code : null;
}

// The only way the app writes saCliente.co_ven. Manual, user-initiated.
export async function updateCustomerSeller(pool: sql.ConnectionPool, coCliRaw: string, coVenRaw: string): Promise<void> {
  const coCli = coCliRaw.trim();
  if (!coCli) throw new Error('coCli requerido');
  const coVen = normalizeCoVen(coVenRaw);
  if (!coVen) throw new Error('coVen requerido');

  try {
    await pool.request()
      .input('sCoCli', sql.Char(16), coCli)
      .input('sCoVen', sql.Char(6), coVen)
      .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
      .execute('pApiActualizarVendedorCliente');
  } catch (err) {
    if (err instanceof Error) {
      if (/^Cliente .* no encontrado/i.test(err.message)) throw new CustomerNotFoundError(coCli);
      if (/^Vendedor .* no encontrado/i.test(err.message)) throw new SellerNotFoundError(coVen);
    }
    throw err;
  }
}
