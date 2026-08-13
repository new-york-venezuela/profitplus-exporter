# SP: RepFacturasPorDevolucionDePuntoVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvDevolucionClienteExt`](../tables/pvDevolucionClienteExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepFacturasPorDevolucionDePuntoVenta
DESCRIPCION: Reporte de Facturas Por Devolucion De Punto de Venta
CREADO POR: SOFTECH SISTEMAS
CREATE DATE: 2013-09-09
LAST DATE:2017-06-27
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepFacturasPorDevolucionDePuntoVenta]
	-- Add the parameters for the stored procedure here
    @sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = null, 
    @sCod_caja_d char(6) = null,
    @sCod_caja_h char(6) = null,
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null,
    @sStatus char(2) = null,
    @bHeaderRep BIT = 0
AS 
    BEGIN    

	SET NOCOUNT ON;

SELECT  pv.num_turno, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status , 
		pv.cod_caja, ca.descrip as des_caja,  
		pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, 
		De.doc_num, De.fec_emis, De.nro_doc, dr.num_doc, de.total_neto 
 from pvturnoexe as pv
		 inner join saCaja as ca on ca.cod_caja = pv.cod_caja
		 inner join pvTurno as tu on tu.co_turno = pv.co_turno
		 inner join pvDevolucionClienteExt as fa on fa.rowguid_num_turno = pv.rowguid
		 inner join saDevolucionCliente as De on De.rowguid = fa.rowguid_doc_num
		 inner join saDevolucionClienteReng as dr on dr.doc_num = De.doc_num
  Where 
		 (@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
		AND (@sNum_turno_h IS NULL OR pv.num_turno <= @sNum_turno_h)
		AND (@sCod_caja_d IS NULL  OR @sCod_caja_d <= pv.cod_caja)
		AND (@sCod_caja_h IS NULL  OR pv.cod_caja  <= @sCod_caja_h)
		AND (@dFecha_d IS NULL     OR  dbo.FechaSimple(de.fec_emis) >= @dFecha_d)
		AND (@dFecha_h IS NULL     OR  dbo.FechaSimple(de.fec_emis) <= @dFecha_h)
		AND (pv.status = @sStatus  OR @sStatus IS NULL )
  group by  pv.num_turno , pv.status, pv.cod_caja, ca.descrip,pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, de.doc_num, de.fec_emis,De.nro_doc,dr.num_doc, de.total_neto
  order by  pv.num_turno, pv.cod_caja, pv.co_turno, pv.user_caj, pv.user_sup, de.doc_num, de.fec_emis,De.nro_doc, dr.num_doc, de.total_neto
    END
```
