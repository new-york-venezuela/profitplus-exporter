# SP: RepResumenTarjetaCierreCajaPuntodeVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<26-03-13>
 Description:	<Reporte de Resumen de Tarjeta Cierre Caja Punto de Venta>
 LAST DATE:		2017-06-27
 =============================================*/ 
CREATE PROCEDURE [dbo].[RepResumenTarjetaCierreCajaPuntodeVenta]
	-- Add the parameters for the stored procedure here
    @sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = null, 
    @sCod_caja_d char(6) = null,
    @sCod_caja_h char(6) = null,
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null,
    @sStatus char(2) = null ,
	@bHeaderRep BIT = 0
AS 
    BEGIN    
    
    SET NOCOUNT ON;
    
select  pv.num_turno,mc.mov_num,(case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status , 
pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini as fecha_ini, pv.fecha_fin as fecha_fin, pv.user_caj, pv.user_sup,mc.fecha,(tc.co_tar), 
tc.des_tar, case when mc.anulado = 0 then mc.monto_h else 0.00 end as monto,
mc.forma_pag as forma_pag ,mc.num_pago,
mc.tipo_mov as tipo_mov,
isnull((case when mc.origen='COB' and mc.forma_pag='TJ'  then mc.origen end),' ') as origen,
mc.doc_num,mc.co_cta_ingr_egr,
isnull((case when mc.transferido ='1' then 'Transferido'  when mc.depositado ='1' then 'Depositado' end), '') as tipo_estado,mc.depositado,
mc.transferido
,mc.forma_pag
 from pvturnoexe                as pv
 inner join pvTurno             as tu on tu.co_turno = pv.co_turno 
 inner join saCaja              as ca on ca.cod_caja = pv.cod_caja 
 inner join saMovimientoCaja    as mc on mc.cod_caja = ca.cod_caja 
 inner join pvMovimientoCajaExt as dc on dc.rowguid_mov_num = mc.rowguid and dc.rowguid_num_turno = pv.rowguid
 inner JOIN saTarjetaCredito    as tc on tc.co_tar   = mc.co_tar
  Where 
	 (@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
 AND (@sNum_turno_h IS NULL OR pv.num_turno  <= @sNum_turno_h)
 AND (@sCod_caja_d  IS NULL OR @sCod_caja_d  <= pv.cod_caja)
 AND (@sCod_caja_h  IS NULL OR pv.cod_caja   <= @sCod_caja_h)
 AND (@dFecha_d     IS NULL OR dbo.FechaSimple(mc.fecha) >= dbo.FechaSimple(@dFecha_d))
 AND (@dFecha_h     IS NULL OR dbo.FechaSimple(mc.fecha) <= dbo.FechaSimple(@dFecha_h))
 AND (pv.status = @sStatus  OR @sStatus IS NULL ) AND ( mc.origen <> 'TRA' )   
 AND mc.forma_pag='TJ'     
 order by pv.num_tu
```
