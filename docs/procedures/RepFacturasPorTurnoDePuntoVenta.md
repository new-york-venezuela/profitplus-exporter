# SP: RepFacturasPorTurnoDePuntoVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepFacturasPorTurnoDePuntoVenta
DESCRIPCION: Reporte de Facturas Por Turno De Punto de Venta
CREADO POR: SOFTECH SISTEMAS
CREATE DATE: 2013-09-09
LAST DATE:2017-06-27
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[RepFacturasPorTurnoDePuntoVenta]
	-- Add the parameters for the stored procedure here
    @sNum_turno_d char(20)  = NULL, 
    @sNum_turno_h char(20)  = NULL, 
    @sCod_caja_d char(6)    = NULL,
    @sCod_caja_h char(6)    = NULL,
    @dFecha_d smalldatetime = NULL,
    @dFecha_h smalldatetime = NULL,
    @sStatus char(2)        = NULL,
    @bHeaderRep BIT = 0
AS 
    BEGIN    
	
	SET NOCOUNT ON;
	
select pv.num_turno,cli.co_cli,cli.cli_des,cli.rif, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status ,
       pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, 
       pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, fav.doc_num, 
       fav.fec_emis, co.cob_num, 
	   case when fav.anulado = 0 then fav.monto_imp else 0.00 end as monto_imp, 
	   case when fav.anulado = 0 then fav.total_neto else 0.00 end as total_neto 
 from pvturnoexe as pv
	 
	 inner join saCaja as ca on ca.cod_caja = pv.cod_caja  
	 inner join pvTurno as tu on tu.co_turno = pv.co_turno 
	 inner join pvfacturaventaExt as fa on fa.rowguid_num_turno = pv.rowguid 
	 inner join safacturaventa as fav on fav.rowguid = fa.rowguid_doc_num
	 inner join saCliente cli on cli.co_cli = fav.co_cli
	 inner join saCobroDocReng as co on co.nro_doc = fav.doc_num
  Where 

		  ((@sNum_turno_d IS NULL  OR @sNum_turno_d <= pv.num_turno)
	  AND ( @sNum_turno_h IS NULL  OR pv.num_turno  <= @sNum_turno_h))   
	  AND ((@sCod_caja_d IS NULL   OR @sCod_caja_d  <= pv.cod_caja)
	  AND ( @sCod_caja_h IS NULL   OR pv.cod_caja   <= @sCod_caja_h)) 
	  AND ((@dFecha_d IS NULL  OR  dbo.FechaSimple(fav.fec_emis) >= @dFecha_d)
	  AND ( @dFecha_h IS NULL  OR  dbo.FechaSimple(fav.fec_emis) <= @dFecha_h))
	  AND (pv.status = @sStatus or @sStatus is null )

  group by  pv.num_turno ,cli.co_cli,cli.cli_des,cli.rif, pv.status, pv.cod_caja,
			ca.descrip,pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, 
			pv.user_sup,
```
