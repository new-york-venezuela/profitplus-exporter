# SP: RepTotalOrdenCompraxArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Ordenes de Compra por Artículo>
-- =============================================
CREATE PROCEDURE [RepTotalOrdenCompraxArticulo]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Sub_Linea_d CHAR(6) = NULL ,
    @sCo_Sub_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
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

        SET @sOperacion = 'ordencomp'

        SELECT
            @sOperacion AS Operacion, OC.fec_emis, OCR.monto_imp, OC.total_neto, ( CASE WHEN OC.anulado = 1 THEN 0.00
                                                                                        ELSE OCR.otros1
                                                                                   END ) AS otros1,
            ( CASE WHEN OC.anulado = 1 THEN 0.00
                   ELSE OCR.otros2
              END ) AS otros2, ( CASE WHEN OC.anulado = 1 THEN 0.00
                                      ELSE OCR.otros3
                                 END ) AS otros3, ( CASE WHEN OC.anulado = 1 THEN 0.00
                                                         ELSE OC.total_bruto
                                                    END ) AS total_bruto, ( CASE WHEN OC.anulado = 1 THEN 0.00
                                                                                 ELSE OC.monto_reca
                                                                            END ) AS monto_reca,
            ( CASE WHEN OC.anulado = 1 THEN 0.00
                   ELSE OC.monto_desc_glob
              END ) AS monto_desc_glob, OCR.co_art, AU.co_uni, ( OCR.otros1 + OCR.otros2 + OCR.otros3 ) AS otros,
            ROUND(dbo.ArtUnidadBase(OCR.co_art, OCR.co_uni, OCR.total_art) * ( CASE WHEN OC.anulado = 1 THEN 0
```
