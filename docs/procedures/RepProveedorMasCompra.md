# SP: RepProveedorMasCompra
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <23-08-10>
-- Description:	<Proveedores con mas Compras>
-- =============================================
CREATE PROCEDURE [RepProveedorMasCompra]
    @sFecha_Emis_d SMALLDATETIME = NULL ,
    @sFecha_Emis_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @iCantidad INT = NULL ,
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

        IF @iCantidad IS NULL 
            SET @iCantidad = 10
 
        DECLARE @temp TABLE
            (
              [co_prov] [char](16) ,
              [prov_des] [varchar](100) ,
              [Compra] [decimal](18, 2) ,
              [cantidad] [int]
            )

        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        P.co_prov, P.prov_des,
                        ROUND(SUM(( DC.total_bruto - DC.monto_desc_glob + DC.monto_reca )), 2) AS Compra,
                        @iCantidad AS Cantidad
                      FROM
                        saProveedor AS P
                        INNER JOIN saDocumentoCompra AS DC ON DC.co_prov = P.co_prov
                      WHERE
                        ( ( @sFecha_Emis_d IS NULL
                            OR dbo.FechaSimple(DC.fec_emis) >= @sFecha_Emis_d
                          )
                          AND ( @sFecha_Emis_h IS NULL
                                OR dbo.FechaSimple(DC.fec_emis) <= @sFecha_Emis_h
                              )
                        )
                        AND ( ( @sCo_Prov_d IS NULL
                                OR P.co_prov >= @sCo_Prov_d
                              )
                              AND ( @sCo_Prov_h IS NULL
                                    OR P.co_prov <= @sCo_Prov_h
                                  )
                            )
                        AND ( @sCo_Moneda IS NULL
                              OR DC.co_mone = @sCo_Moneda
```
