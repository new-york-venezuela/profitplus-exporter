// lib/pricing/segment-erp.ts
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import type { SegmentErp } from './segments-service';
import {
  createSegmentErp, getSegmentRow, listSegmentRows, listTipCliCodes, updateSegmentErp,
} from './tipo-cliente';
import { assignCustomerToSegment } from './sa-cliente-fields';

export function realSegmentErp(pool: ConnectionPool): SegmentErp {
  return {
    listCodes: () => listTipCliCodes(pool),
    listSegments: () => listSegmentRows(pool),
    getSegment: tipCli => getSegmentRow(pool, tipCli),
    createSegment: p => createSegmentErp(pool, p),
    updateSegment: p => updateSegmentErp(pool, p),
    getCustomer: async coCli => {
      const r = await pool.request().input('coCli', sql.Char(16), coCli)
        .query(`SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS cliDes, RTRIM(tip_cli) AS tipCli FROM saCliente WHERE RTRIM(co_cli) = RTRIM(@coCli)`);
      return r.recordset[0] ?? null;
    },
    moveCustomer: (coCli, target, user) => assignCustomerToSegment(pool, coCli, target, user),
  };
}
