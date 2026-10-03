import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import type { SweepErp } from './sweep';
import { getSegmentRow } from './tipo-cliente';
import { assignCustomerToSegment } from './sa-cliente-fields';

export function realSweepErp(pool: ConnectionPool): SweepErp {
  return {
    getSegment: async tipCli => {
      const r = await getSegmentRow(pool, tipCli);
      return r ? { tipCli: r.tipCli } : null;
    },
    listCustomersInSegment: async tipCli => {
      const r = await pool.request().input('t', sql.Char(6), tipCli)
        .query(`SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS cliDes FROM saCliente WHERE RTRIM(tip_cli) = RTRIM(@t)`);
      return r.recordset;
    },
    moveCustomer: (coCli, target, user) => assignCustomerToSegment(pool, coCli, target, user),
  };
}
