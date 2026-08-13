# SP: RepTotalCotizacionProveedorEmpresaMultimoneda
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Cotizaciones de la Empresa Multimoneda>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalCotizacionProveedorEmpresaMultimoneda]

    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
	@sCo_Moneda_Rep CHAR (6) = NULL,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)

				Declare @MonedaBase char(6)
             Select @MonedaBase = g_moneda from par_emp

		if (@sCo_Moneda_Rep is null)
		    set @sCo_Moneda_Rep = @MonedaBase

        SET @sOperacion = 'Cotización'


         SELECT
            @sOperacion AS Operacion, CP.doc_num, CP.descrip, CP.co_prov, CP.co_mone, CP.co_cond, CP.fec_emis,
            CP.fec_venc, CP.fec_reg, CP.anulado, CP.status, CP.n_control, CP.tasa, CP.porc_desc_glob,
            ( CASE WHEN CP.anulado = 1 THEN 0.00
                   ELSE CP.monto_desc_glob
              END ) AS monto_desc_glob, CP.porc_reca, ( CASE WHEN CP.anulado = 1 THEN 0.00
                                                             ELSE CP.monto_reca
                                                        END ) AS monto_reca,
            ( CASE WHEN CP.anulado = 1 THEN 0.00
                   ELSE CPR.monto_imp
              END ) AS monto_imp, CP.monto_imp2, CP.monto_imp3, ( CASE WHEN CP.anulado = 1 THEN 0.00
                                                                       ELSE CPR.otros1
                                                                  END ) AS otros1, ( CASE WHEN CP.anulado = 1 THEN 0.00
                                                                                          ELSE CPR.otros2
                                                                                     END ) AS otros2,
            ( CASE WHEN CP.anulado = 1 THEN 0.00
                   ELSE CPR.otros3
              END ) AS otros3, CP.total_neto, CP.saldo, CP.dir_ent, CP.comentario, CP.dis_cen, CP.feccom, CP.numcom,
            CP.impresa
```
