# SP: RepResumenArticulosVendidos
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCaja`](../tables/saCaja.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepResumenArticulosVendidos
DESCRIPCION: Articulos Vendidos por Turno
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepResumenArticulosVendidos]
	-- Add the parameters for the stored procedure here
    @sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = null, 
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN    
 	
 	SET NOCOUNT ON;	
 	
select PV.NUM_TURNO, 
	(case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status ,
	pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, 
	a.co_art, a.art_des, 
--r.doc_num, 
sum(r.prec_vta) as prec_vta,
sum(r.monto_imp) as monto_imp,
sum(r.monto_desc_glob) as monto_desc_glob,
sum(r.monto_reca_glob) as monto_reca_glob,
sum(r.monto_imp_afec_glob) as monto_imp_afec_glob,
sum([dbo].[ArtUnidadBase](r.co_art,r.co_uni,r.total_art) )as TotalArtN,
u.co_uni, 
sum(r.reng_neto) as Subtotal,
sum(r.reng_neto - r.monto_desc_glob + r.monto_reca_glob + (r.monto_imp + (r.monto_imp_afec_glob))) as montoPorArticulo

from pvturnoexe as pv
	inner join pvTurno as tu on tu.co_turno = pv.co_turno
	inner join saCaja as ca on ca.cod_caja = pv.cod_caja
	inner join PVFacturaVentaExt as fve on fve.rowguid_num_turno = pv.rowguid 
	inner join saFacturaVenta as fv on fv.rowguid = fve.rowguid_doc_num  
	inner join saFacturaVentaReng R on fv.doc_num = r.doc_num 
	inner join saArticulo A on a.co_art = r.co_art
	inner join saArtUnidad U on U.co_art = A.co_Art 
WHERE 
	@sNum_turno_d = pv.num_turno
	--(@sNum_turno_d IS NULL   OR @sNum_turno_d <= pv.num_turno)
	--AND (@sNum_turno_h IS NULL  OR pv.num_turno <= @sNum_turno_h) 
	AND (@dFecha_d IS NULL OR  dbo.FechaSimple(fv.fec_emis) >= dbo.FechaSimple(@dFecha_d))
	AND (@dFecha_h IS NULL OR  dbo.FechaSimple(fv.fec_emis) <= dbo.FechaSimple(@dFecha_h))
	AND (fv.anulado=0)
	AND (fve.estado='P')
	and U.uni_principal = 1
group by 
	PV.NUM_TURNO, pv.status ,
	pv.cod_caja, ca.descrip ,  pv
```
