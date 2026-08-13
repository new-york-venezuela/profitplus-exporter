# SP: RepResumenValeCierreCajaPuntodeVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvCobroExt`](../tables/pvCobroExt.md)
- [`pvRenglonTicket`](../tables/pvRenglonTicket.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:	<5-08-13>
 Description:	<Resumen Vale Alimentacion para Cierre de Caja>
 =============================================*/ 
CREATE PROCEDURE [dbo].[RepResumenValeCierreCajaPuntodeVenta]
	-- Add the parameters for the stored procedure here
    @sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = NULL, 
    @sCod_caja_d char(6) = null,
    @sCod_caja_h char(6) = null,
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null,
    @sStatus char(2) = NULL,
    @dStock decimal(18,5) = NULL,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN    

	SET NOCOUNT ON;
	
select  pv.num_turno,(case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status , 
pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini as fechaini, pv.fecha_fin as fechafin, pv.user_caj, pv.user_sup, 
co.cob_num, co.fecha,(case when ctp.forma_pag = 'CT' then 'VA'  when ctp.forma_pag = 'VA' then 'VA' end) as forma_pag, va.co_vale,va.vale_descrip, rt.cantidad, vr.valor,  rt.reng_num_vale
 from pvturnoexe as pv
 inner join pvTurno as tu on tu.co_turno = pv.co_turno
inner join saCaja as ca on ca.cod_caja = pv.cod_caja
inner join pvCobroExt as coe  on coe.rowguid_num_turno = pv.rowguid
inner join saCobro as co on co.rowguid = coe.rowguid_cob_num
inner join saCobroTpReng as ctp on ctp.cob_num = co.cob_num and ctp.forma_pag = 'CT'
inner join pvRenglonTicket as rt on rt.cob_num = ctp.cob_Num and rt.reng_num = ctp.reng_num
inner join pvValeAlimentacionReng as vr on vr.reng_num = rt.reng_num_vale and rt.co_vale = vr.co_vale 
inner join pvValeAlimentacion as va on va.co_vale= vr.co_vale
WHERE 
		(@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
 AND	(@sNum_turno_h IS NULL OR pv.num_turno <= @sNum_turno_h)
 AND	(@dFecha_d IS NULL OR  dbo.FechaSimple(co.fecha) >= dbo.FechaSimple(@dFecha_d))
 AND	(@dFecha_h IS NULL OR  dbo.FechaSimple(co.fecha) <= dbo.FechaSimple(@dFecha_h))
 AND	CO.anulado = 0
ORDER BY va.co_vale,vr.valor

    END
```
