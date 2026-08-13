# SP: pvRepArqueoCajaOLD
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvDevolucionClienteExt`](../tables/pvDevolucionClienteExt.md)
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<05/06/2013>
 Description:	<Arqueo de Caja Punto de Venta>
 =============================================*/ 
CREATE PROCEDURE [dbo].[pvRepArqueoCajaOLD]
	@sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = null,
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null
    
    AS 
    BEGIN    
  
 select PV.NUM_TURNO, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status , pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, 

(select Isnull (sum (monto_h),0) from saMovimientoCaja as mc inner join pvMovimientoCajaExt as pm on mc.rowguid = pm.rowguid_mov_num 
 where pv.rowguid = pm.rowguid_num_turno and forma_pag = 'EF' and origen = 'COB' and tipo_mov = 'i' and (( @sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno ) AND ( @sNum_turno_h IS NULL  OR pv.num_turno <= @sNum_turno_h  ))) as efectivoIng, 

(select Isnull (sum (monto_h),0)   from saMovimientoCaja as mc inner join pvMovimientoCajaExt as pm on mc.rowguid = pm.rowguid_mov_num 
 where pv.rowguid = pm.rowguid_num_turno and forma_pag = 'CH' and origen = 'COB' and tipo_mov = 'i'  and (( @sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno ) AND ( @sNum_turno_h IS NULL  OR pv.num_turno <= @sNum_turno_h  ))) as chequesIng,
 
 (select  Isnull (sum (monto_h),0)   from saMovimientoCaja as mc inner join pvMovimientoCajaExt as pm on mc.rowguid = pm.rowguid_mov_num 
  where pv.rowguid = pm.rowguid_num_turno and forma_pag = 'TJ' and origen = 'COB' and tipo_mov = 'i' and (( @sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno ) AND ( @sNum_turno_h IS NULL  OR pv.num_turno <= @sNum_turno_h  ))) as TarjetasIng,
  
  (select  Isnull (sum (monto_h),0)   from saMovimientoCaja as mc inner join pvMovimientoCajaExt as pm on mc.rowguid = pm.rowguid_mov_num 
  where (pv.rowguid = pm.rowguid_num_turno)   and forma_pag = 'CT' and origen = 'COB' and tipo_mov = 'i' and (( @sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno ) AND ( @sNum_turno_h IS NULL  OR pv.num_turno <= @sNum_turno_h  ))) as ValeIng,
  
  
  (Select Isnull (sum (monto_h),0)   from saMovimientoCaja as mc inner join pvMovimientoCajaExt as pm on mc.rowguid = pm.rowguid_mov_num 
   where pv.rowguid = pm.rowguid_num_turno and  forma_pag
```
