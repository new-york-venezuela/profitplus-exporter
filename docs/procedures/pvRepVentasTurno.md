# SP: pvRepVentasTurno
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:  pvRepVentasTurno
DESCRIPCION: Reporte de Ventas Turno
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[pvRepVentasTurno]
	-- Add the parameters for the stored procedure here
    @sNum_turno_d char(20)    = NULL, 
    @sNum_turno_h char(20)    = NULL, 
    @sCod_caja_d char(6)      = NULL,
    @sCod_caja_h char(6)      = NULL,
    @dFecha_d smalldatetime   = NULL,
    @dFecha_h smalldatetime   = NULL,
    @sStatus char(2)          = NULL,
    @dStock decimal(18,5)     = NULL,
    @sCo_Sucursal CHAR(6)     = NULL,
    @sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6)          = NULL 
    --@bHeaderRep BIT = 0
AS 
    BEGIN    
SELECT 
       pv.num_turno,cli.co_cli,cli.cli_des,cli.rif, 
       (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status ,
	   pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini, 
	   pv.fecha_fin, pv.user_caj, pv.user_sup, fav.doc_num, fav.fec_emis, co.cob_num,
       case when fav.anulado = 0 and cob.anulado = 0 then fav.monto_imp  else 0.00 end as monto_imp, 
       case when fav.anulado = 0 and cob.anulado = 0 then fav.total_neto else 0.00 end as total_neto 
 FROM 
     pvturnoexe                   as pv
	 INNER JOIN saCaja            as ca  on ca.cod_caja          = pv.cod_caja
	 INNER JOIN pvTurno           as tu  on tu.co_turno          = pv.co_turno
	 INNER JOIN pvfacturaventaExt as fa  on fa.rowguid_num_turno = pv.rowguid
	 INNER JOIN safacturaventa    as fav on fav.rowguid          = fa.rowguid_doc_num
	 INNER JOIN saCliente         as cli on cli.co_cli           = fav.co_cli
	 INNER JOIN saCobroDocReng    as co  on co.nro_doc           = fav.doc_num AND co.co_tipo_doc = 'FACT'
	 INNER JOIN saCobro           as cob on cob.cob_num          = co.cob_num
WHERE
		 (@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
	 AND (@sNum_turno_h IS NULL OR pv.num_turno  <= @sNum_turno_h)
	 AND (@sCod_caja_d  IS NULL OR @sCod_caja_d  <= pv.cod_caja)
	 AND (@sCod_caja_h  IS NULL OR pv.cod_caja   <= @sCod_caja_h)
	 AND (@dFecha_d     IS NULL OR dbo.FechaSimple(@dFecha_d)     <= dbo.FechaSimple(fav.fec_emis))
	 AND (@
```
