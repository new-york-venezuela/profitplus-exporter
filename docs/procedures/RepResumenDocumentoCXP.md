# SP: RepResumenDocumentoCXP
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-08-10>
-- Description:	<Resumen de Documentos de Venta>
-- =============================================
CREATE PROCEDURE [dbo].[RepResumenDocumentoCXP]
    @sFecha_Emis_d SMALLDATETIME = NULL ,
    @sFecha_Emis_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sFecha_Emis_d IS NOT NULL 
            SET @sFecha_Emis_d = dbo.FechaSimple(@sFecha_Emis_d)
        IF @sFecha_Emis_h IS NOT NULL 
            SET @sFecha_Emis_h = dbo.FechaSimple(@sFecha_Emis_h)

        SELECT
            DC.co_tipo_doc, SUM(DC.total_neto) AS monto
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saProveedor AS P ON P.co_prov = DC.co_prov
        WHERE
            ( ( @sFecha_Emis_d IS NULL
                OR dbo.FechaSimple(DC.fec_emis) >= @sFecha_Emis_d
              )
              AND ( @sFecha_Emis_h IS NULL
                    OR dbo.FechaSimple(DC.fec_emis) <= @sFecha_Emis_h
                  )
            )
            AND ( @sCo_Prov_d IS NULL
                  OR DC.co_prov >= @sCo_Prov_d
                )
            AND ( @sCo_Prov_h IS NULL
                  OR DC.co_prov <= @sCo_Prov_h
                )
            AND ( @sCo_Moneda IS NULL
                  OR DC.co_mone = @sCo_Moneda
                )
            AND ( @sCo_Sucursal IS NULL
                  OR DC.co_sucu_in = @sCo_Sucursal
                )
            AND ( DC.anulado = 0 )
            AND DC.co_tipo_doc IN ( 'FACT', 'N/CR', 'N/DB', 'CHEQ', 'ISLR', 'ADEL', 'GIRO', 'CFXG', 'IVAN', 'IVAP' )
        GROUP BY
            DC.co_tipo_doc
        UNION
        SELECT
            'AJPO', SUM(DC.total_neto) AS monto
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saProveedor AS P ON P.co_prov = DC.co_prov
        WHERE
            ( ( @sFecha_Emis_d IS NULL
                OR dbo.FechaSimple(DC.fec_emis) >= @sFecha_Emis_d
              )
              AND ( @sFecha_Emis_h IS NULL
                    OR dbo.FechaSimple(DC.fec_emis) <= @sFecha_Emis_h
                  )
            )
            AND ( @sCo_Prov_d IS NULL
                  OR DC.co
```
