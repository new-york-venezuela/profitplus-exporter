# SP: RepResumenTransferencias
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoBancoExt`](../tables/pvMovimientoBancoExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<26-03-13>
 Description:	<Reporte de Resumen de Depósitos Punto de Venta>
 LAST DATE:		2017-06-27
 =============================================*/ 
CREATE PROCEDURE [dbo].[RepResumenTransferencias]
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
        
	select  
		pv.num_turno,
		mc.mov_num,
		(case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status , 
		pv.cod_caja,
		ca.descrip as des_caja,
		pv.co_turno, tu.des_turno, 
		pv.fecha_ini as fecha_ini, 
		pv.fecha_fin as fecha_fin, 
		pv.user_caj, 
		pv.user_sup,
		pag.forma_pag,
		pag.num_doc,
		mc.fecha,
		mc.cod_cta,
		cb.num_cta,
		mc.origen,
		mc.co_cta_ingr_egr,
		mc.monto_d,
		mc.monto_h,
		mc.mov_num,
		mc.descrip
   
	 from pvturnoexe                as pv
		inner join pvTurno             as tu on tu.co_turno = pv.co_turno 
		inner join saCaja              as ca on ca.cod_caja = pv.cod_caja 
		inner join pvMovimientoBancoExt as dc on dc.rowguid_num_turno = pv.rowguid
		inner join saMovimientoBanco    as mc on mc.rowguid = dc.rowguid_mov_num 
		inner join saCuentaBancaria as cb on cb.cod_cta = mc.cod_cta
		inner join saCobroTPReng as pag on pag.cob_num = mc.cob_pag
	Where 
		 (@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
	 AND (@sNum_turno_h IS NULL OR pv.num_turno  <= @sNum_turno_h)
	 AND (@sCod_caja_d  IS NULL OR @sCod_caja_d  <= pv.cod_caja)
	 AND (@sCod_caja_h  IS NULL OR pv.cod_caja   <= @sCod_caja_h)
	 AND (@dFecha_d     IS NULL OR dbo.FechaSimple(mc.fecha) >= dbo.FechaSimple(@dFecha_d))
	 AND (@dFecha_h     IS NULL OR dbo.FechaSimple(mc.fecha) <= dbo.FechaSimple(@dFecha_h))
	 AND (pv.status = @sStatus  OR @sStatus IS NULL ) AND ( mc.origen <> 'TRA' )   
	 AND (pag.forma_pag='TP')  
    
	 order by pv.num_turno,mc.mov_num

END
```
