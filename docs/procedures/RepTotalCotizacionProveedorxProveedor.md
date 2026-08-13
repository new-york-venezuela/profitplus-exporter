# SP: RepTotalCotizacionProveedorxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Cotizaciones por Proveedor>
-- =============================================
CREATE PROCEDURE [RepTotalCotizacionProveedorxProveedor]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
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

        SET @sOperacion = 'Cotización'

        SELECT
            @sOperacion AS Operacion, CP.doc_num, CP.descrip, CP.co_prov, CP.co_mone, CP.co_cond, CP.fec_emis,
            CP.fec_venc, CP.fec_reg, CP.anulado, CP.status, CP.n_control, CP.tasa, CP.porc_desc_glob,
            ( CASE WHEN CP.anulado = 1 THEN 0.00
                   ELSE CP.monto_desc_glob
              END ) AS monto_desc_glob, CP.porc_reca, ( CASE WHEN CP.anulado = 1 THEN 0.00
                                                             ELSE CP.monto_reca
                                                        END ) AS monto_reca, 
		--(CASE WHEN CP.anulado = 1 THEN 0.00 ELSE CP.total_bruto END) AS total_bruto,
            ( CASE WHEN CP.anulado = 1 THEN 0.00
                   ELSE CPR.monto_imp
              END ) AS monto_imp, CP.monto_imp2, CP.monto_imp3, ( CASE WHEN CP.anulado = 1 THEN 0.00
                                                                       ELSE CPR.otros1
                                                                  END ) AS otros1, ( CASE WHEN CP.anulado = 1 THEN 0.00
                                                                                          ELSE CPR.otros2
                                                                                     END ) AS otros2,
            ( CASE WHEN CP.anulado = 1 THEN 0.00
                   ELSE CPR.otros3
              END ) AS otros3, CP.total_neto, CP.saldo, CP.dir_ent, CP.comen
```
