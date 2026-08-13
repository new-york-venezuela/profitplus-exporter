# SP: RepTotalNotaEntregaxArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Notas de Entrega por Artículo>
-- =============================================
CREATE PROCEDURE [RepTotalNotaEntregaxArticulo]
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

        SET @sOperacion = 'notaentre'

        SELECT
            @sOperacion AS Operacion, NE.doc_num, NE.descrip, NE.co_cli, NE.co_tran, NE.co_mone, NE.co_ven, NE.co_cond,
            NE.fec_emis, NE.fec_venc, NE.fec_reg, NE.anulado, NE.status, NE.n_control, NE.ven_ter, NE.tasa,
            NE.porc_desc_glob, ( CASE WHEN NE.anulado = 1 THEN 0.00
                                      ELSE NE.monto_desc_glob
                                 END ) AS monto_desc_glob, NE.porc_reca, ( CASE WHEN NE.anulado = 1 THEN 0.00
                                                                                ELSE NE.monto_reca
                                                                           END ) AS monto_reca,
            ( CASE WHEN NE.anulado = 1 THEN 0.00
                   ELSE NE.total_bruto
              END ) AS total_bruto, ( CASE WHEN NE.anulado = 1 THEN 0.00
                                           ELSE NER.monto_imp
                                      END ) AS monto_imp, NE.monto_imp2, NE.monto_imp3,
            ( CASE WHEN NE.anulado = 1 THEN 0.00
                   ELSE NER.otros1
              END ) AS otros1, ( CASE WHEN NE.anulado = 1 THEN 0.00
                                      ELSE NER.otros2
                                 END ) AS otros2, ( CASE WHEN NE.anulado = 1 THEN 0.00
                                                         E
```
