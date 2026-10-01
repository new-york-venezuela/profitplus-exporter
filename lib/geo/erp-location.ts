// lib/geo/erp-location.ts
import sql from 'mssql';

// Same constant the inventory adjustments route uses for ERP audit stamps.
export const ERP_USER_CODE = 'PROFIT';

export interface LocationUpdate {
  coCli: string;
  campo1?: string | null;
  dirEnt2?: string | null;
}

export class CustomerNotFoundError extends Error {
  constructor(coCli: string) {
    super(`Cliente ${coCli} no encontrado`);
    this.name = 'CustomerNotFoundError';
  }
}

export async function updateCustomerLocation(pool: sql.ConnectionPool, update: LocationUpdate): Promise<void> {
  const coCli = update.coCli.trim();
  if (!coCli) throw new Error('coCli requerido');

  try {
    await pool.request()
      .input('sCoCli', sql.Char(16), coCli)
      .input('sCampo1', sql.VarChar(60), update.campo1 ?? null)
      .input('sDirEnt2', sql.VarChar(sql.MAX), update.dirEnt2 ?? null)
      .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
      .execute('pApiActualizarUbicacionCliente');
  } catch (err) {
    if (err instanceof Error && /no encontrado/i.test(err.message)) throw new CustomerNotFoundError(coCli);
    throw err;
  }
}
