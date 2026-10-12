import sql from 'mssql';
import { ERP_USER_CODE } from '@/lib/geo/erp-location';
import { updateCustomerSeller } from '@/lib/geo/erp-seller';
import type { VisitFrequency } from './frequency';

export type DocKind = 'FACT' | 'DEV';

export interface ErpCustomerState { coCli: string; coVen: string; coSeg: string | null; coZon: string; frecuVist: string | null }
export interface SellerDoc { kind: DocKind; docNum: string; coCli: string; coVen: string; fecEmis: string }

export interface ErpGateway {
  listCustomers(): Promise<Map<string, ErpCustomerState>>;
  listActiveSellers(): Promise<string[]>;
  listSegments(): Promise<{ byDesc: Map<string, string>; codes: Set<string> }>;
  listSellerDocs(sinceIso: string): Promise<SellerDoc[]>;
  createSegment(coSeg: string, segDes: string): Promise<void>;
  setCustomerSeller(coCli: string, coVen: string): Promise<void>;
  // Rollback only: like setCustomerSeller but accepts a seller that has been deactivated since.
  restoreCustomerSeller(coCli: string, coVen: string): Promise<void>;
  setCustomerSegment(coCli: string, coSeg: string): Promise<void>;
  setDocSeller(kind: DocKind, docNum: string, coVen: string): Promise<void>;
  listZones(): Promise<Set<string>>;
  createZone(coZon: string, zonDes: string): Promise<void>;
  setCustomerRoute(coCli: string, coZon: string, frecuencia: VisitFrequency): Promise<void>;
  // Rollback only: restores any previous zone and ANY previous frecu_vist (NULL or free text).
  restoreCustomerRoute(coCli: string, coZon: string, frecuVist: string | null): Promise<void>;
}

export function mssqlGateway(pool: sql.ConnectionPool): ErpGateway {
  return {
    async listCustomers() {
      const r = await pool.request().query(
        `SELECT RTRIM(co_cli) AS coCli, RTRIM(co_ven) AS coVen, RTRIM(co_seg) AS coSeg,
                RTRIM(co_zon) AS coZon, RTRIM(frecu_vist) AS frecuVist FROM saCliente`);
      return new Map(r.recordset.map((x: ErpCustomerState) => [x.coCli, {
        coCli: x.coCli, coVen: x.coVen, coSeg: x.coSeg, coZon: x.coZon, frecuVist: x.frecuVist,
      }]));
    },
    async listZones() {
      const r = await pool.request().query(`SELECT RTRIM(co_zon) AS coZon FROM saZona`);
      return new Set((r.recordset as { coZon: string }[]).map(x => x.coZon));
    },
    async createZone(coZon, zonDes) {
      await pool.request()
        .input('sCoZon', sql.Char(6), coZon).input('sZonDes', sql.VarChar(60), zonDes)
        .input('sCoUsIn', sql.Char(6), ERP_USER_CODE)
        .execute('pApiInsertarZona');
    },
    async setCustomerRoute(coCli, coZon, frecuencia) {
      await pool.request()
        .input('sCoCli', sql.Char(16), coCli).input('sCoZon', sql.Char(6), coZon)
        .input('sFrecuVist', sql.VarChar(60), frecuencia).input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiActualizarRutaCliente');
    },
    async restoreCustomerRoute(coCli, coZon, frecuVist) {
      await pool.request()
        .input('sCoCli', sql.Char(16), coCli).input('sCoZon', sql.Char(6), coZon)
        .input('sFrecuVist', sql.VarChar(60), frecuVist).input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiRestaurarRutaCliente');
    },
    async listActiveSellers() {
      const r = await pool.request().query(`SELECT RTRIM(co_ven) AS coVen FROM saVendedor WHERE inactivo = 0`);
      return r.recordset.map((x: { coVen: string }) => x.coVen);
    },
    async listSegments() {
      const r = await pool.request().query(`SELECT RTRIM(co_seg) AS coSeg, RTRIM(seg_des) AS segDes FROM saSegmento`);
      const byDesc = new Map<string, string>();
      const codes = new Set<string>();
      for (const x of r.recordset as { coSeg: string; segDes: string }[]) {
        codes.add(x.coSeg);
        byDesc.set(x.segDes.trim().toLowerCase(), x.coSeg);
      }
      return { byDesc, codes };
    },
    async listSellerDocs(sinceIso) {
      const r = await pool.request().input('since', sql.VarChar(10), sinceIso).query(`
        SELECT 'FACT' AS kind, RTRIM(doc_num) AS docNum, RTRIM(co_cli) AS coCli, RTRIM(co_ven) AS coVen,
               CONVERT(char(10), fec_emis, 23) AS fecEmis
        FROM saFacturaVenta WHERE anulado = 0 AND fec_emis >= CONVERT(date, @since, 23)
        UNION ALL
        SELECT 'DEV', RTRIM(doc_num), RTRIM(co_cli), RTRIM(co_ven), CONVERT(char(10), fec_emis, 23)
        FROM saDevolucionCliente WHERE anulado = 0 AND fec_emis >= CONVERT(date, @since, 23)`);
      return r.recordset as SellerDoc[];
    },
    async createSegment(coSeg, segDes) {
      await pool.request()
        .input('sCoSeg', sql.Char(6), coSeg).input('sSegDes', sql.VarChar(60), segDes)
        .input('sCoUsIn', sql.Char(6), ERP_USER_CODE)
        .execute('pApiInsertarSegmento');
    },
    async setCustomerSeller(coCli, coVen) {
      await updateCustomerSeller(pool, coCli, coVen);
    },
    async restoreCustomerSeller(coCli, coVen) {
      await pool.request()
        .input('sCoCli', sql.Char(16), coCli).input('sCoVen', sql.Char(6), coVen)
        .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiRestaurarVendedorCliente');
    },
    async setCustomerSegment(coCli, coSeg) {
      await pool.request()
        .input('sCoCli', sql.Char(16), coCli).input('sCoSeg', sql.Char(6), coSeg)
        .input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiActualizarSegmentoCliente');
    },
    async setDocSeller(kind, docNum, coVen) {
      await pool.request()
        .input('sTipo', sql.VarChar(4), kind).input('sNroDoc', sql.Char(20), docNum)
        .input('sCoVen', sql.Char(6), coVen).input('sCoUsMo', sql.Char(6), ERP_USER_CODE)
        .execute('pApiCorregirVendedorDocumento');
    },
  };
}
