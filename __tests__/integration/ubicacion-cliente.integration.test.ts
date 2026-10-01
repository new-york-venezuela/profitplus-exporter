// WRITES to the ERP (then restores). Run ONLY against a non-production
// Profit Plus instance, after `bun run migrate:mssql` has installed
// pApiActualizarUbicacionCliente. `bun run test:geo-erp`.
import { describe, test, expect } from 'bun:test';
import sql from 'mssql';
import { getPool } from '@/lib/db/mssql';
import { updateCustomerLocation, CustomerNotFoundError } from '@/lib/geo/erp-location';

describe('pApiActualizarUbicacionCliente', () => {
  test('writes campo1 + dir_ent2, stamps audit columns, and leaves other columns alone', async () => {
    const pool = await getPool();
    const row = (await pool.request().query(
      `SELECT TOP 1 co_cli, campo1, dir_ent2, co_us_mo, fe_us_mo, direc1 FROM saCliente WHERE inactivo = 0 ORDER BY co_cli`,
    )).recordset[0];
    const coCli = String(row.co_cli).trim();

    try {
      await updateCustomerLocation(pool, {
        coCli, campo1: 'Coordenadas: (10.480600, -66.903600)', dirEnt2: 'DIRECCION DE PRUEBA E2E',
      });
      const after = (await pool.request().input('c', sql.Char(16), coCli).query(
        `SELECT campo1, dir_ent2, co_us_mo, direc1 FROM saCliente WHERE co_cli = @c`,
      )).recordset[0];
      expect(after.campo1).toBe('Coordenadas: (10.480600, -66.903600)');
      expect(after.dir_ent2).toBe('DIRECCION DE PRUEBA E2E');
      expect(String(after.co_us_mo).trim()).toBe('PROFIT');
      expect(after.direc1).toBe(row.direc1);

      // NULL = unchanged
      await updateCustomerLocation(pool, { coCli, dirEnt2: 'OTRA' });
      const again = (await pool.request().input('c', sql.Char(16), coCli).query(
        `SELECT campo1, dir_ent2 FROM saCliente WHERE co_cli = @c`,
      )).recordset[0];
      expect(again.campo1).toBe('Coordenadas: (10.480600, -66.903600)');
      expect(again.dir_ent2).toBe('OTRA');
    } finally {
      await pool.request()
        .input('c', sql.Char(16), coCli)
        .input('campo1', sql.VarChar(60), row.campo1)
        .input('dir', sql.VarChar(sql.MAX), row.dir_ent2)
        .input('us', sql.Char(6), row.co_us_mo)
        .input('fe', sql.DateTime, row.fe_us_mo)
        .query(`UPDATE saCliente SET campo1=@campo1, dir_ent2=@dir, co_us_mo=@us, fe_us_mo=@fe WHERE co_cli=@c`);
    }
  });

  test('unknown customer raises CustomerNotFoundError', async () => {
    const pool = await getPool();
    await expect(updateCustomerLocation(pool, { coCli: 'NO-EXISTE-XYZ', campo1: 'x' }))
      .rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});
