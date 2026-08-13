# SP: RepCobroPorTurno
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvCobroExt`](../tables/pvCobroExt.md)
- [`pvRenglonTicket`](../tables/pvRenglonTicket.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepCobroPorTurno
DESCRIPCION: Reporte de Cobro por Turno De Punto de Venta
CREADO POR: SOFTECH SISTEMAS
LAST DATE:2017-06-27
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[RepCobroPorTurno]
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
        
select pv.num_turno, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' 

then 'En Espera' when pv.status = 'A' then 'Activo' end) as status , 
pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, 

De.cob_num, De.fecha, dr.nro_doc,  COALESCE(ct.mov_num_c,ct.mov_num_b) mov_num_c,
(case when ct.forma_pag='CT' then 'VA' else ct.forma_pag end) as forma_pag, 
case when de.anulado = 0 then ct.mont_doc else 0.00 end as mont_doc,
case when ct.forma_pag = 'TJ' then tc.co_tar  when ct.forma_pag = 'CH' then ct.co_ban  when ct.forma_pag = 'CT' then 

cetb.co_vale when ct.forma_pag = 'DP' then cb.cod_cta when ct.forma_pag = 'TP' then cb.cod_cta else '' end  as co_tar , 
case when ct.forma_pag = 'TJ' then tc.des_tar when ct.forma_pag = 'CH' then ba.des_ban when ct.forma_pag = 'CT' then 

cetb.vale_descrip when ct.forma_pag = 'DP' then cb.num_cta when ct.forma_pag = 'TP' then cb.num_cta else '' end  as des_tar, coalesce( Mon.co_mone, mun.co_mone)  co_mone,  coalesce (Mon.cambio,mc.tasa) tasa_divisa,


case when mb.tipo_op in ('DP' ,'IN','NC','RD','TP')  then mb.monto_h 
     when mb.tipo_op in ('TR','CH','ND','RC','ID') then mb.monto_d 
end   as monto_banco ,
case when mc.tipo_mov in ('I' )  then mc.monto_h 
     when mc.tipo_mov in ('E') then mc.monto_d 
end   as monto_caja 


                                                
 from pvturnoexe as pv
	 inner join saCaja as ca on ca.cod_caja = pv.cod_caja
	 inner join pvTurno as tu on tu.co_turno = pv.co_turno
	 inner join pvCobroExt as fa on fa.rowguid_num_turno = pv.rowguid
	 inner join saCobro
```
