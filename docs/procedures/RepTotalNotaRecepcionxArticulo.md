# SP: RepTotalNotaRecepcionxArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Notas de Recepcion por Artículo>
-- =============================================
CREATE PROCEDURE [RepTotalNotaRecepcionxArticulo]
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

        SET @sOperacion = 'notarec'

        SELECT
            @sOperacion AS Operacion, NR.fec_emis, NRR.monto_imp, NR.total_neto, ( CASE WHEN NR.anulado = 1 THEN 0.00
                                                                                        ELSE NR.otros1
                                                                                   END ) AS otros1,
            ( CASE WHEN NR.anulado = 1 THEN 0.00
                   ELSE NR.otros2
              END ) AS otros2, ( CASE WHEN NR.anulado = 1 THEN 0.00
                                      ELSE NR.otros3
                                 END ) AS otros3, ( CASE WHEN NR.anulado = 1 THEN 0.00
                                                         ELSE NR.total_bruto
                                                    END ) AS total_bruto, ( CASE WHEN NR.anulado = 1 THEN 0.00
                                                                                 ELSE NR.monto_reca
                                                                            END ) AS monto_reca,
            ( CASE WHEN NR.anulado = 1 THEN 0.00
                   ELSE NRR.monto_desc_glob
              END ) AS monto_desc_glob, NRR.co_art, AU.co_uni, ( NRR.otros1 + NRR.otros2 + NRR.otros3 ) AS otros,
            ROUND(dbo.ArtUnidadBase(NRR.co_art, NRR.co_uni, NRR.total_art) * ( CASE WHEN NR.anulado = 1 THEN 0
```
