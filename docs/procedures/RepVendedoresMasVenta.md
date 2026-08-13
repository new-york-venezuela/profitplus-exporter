# SP: RepVendedoresMasVenta
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <14-10-10>
-- Description:	<Vendedores con mas Ventas>
-- =============================================
CREATE PROCEDURE [RepVendedoresMasVenta]
    @dFecha_Emis_d SMALLDATETIME = NULL ,
    @dFecha_Emis_h SMALLDATETIME = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @iCantidad INT = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_Emis_d IS NOT NULL 
            SET @dFecha_Emis_d = dbo.FechaSimple(@dFecha_Emis_d)
        IF @dFecha_Emis_h IS NOT NULL 
            SET @dFecha_Emis_h = dbo.FechaSimple(@dFecha_Emis_h)

        IF @iCantidad IS NULL 
            SET @iCantidad = 10

        DECLARE @temp TABLE
            (
              [co_ven] [char](16) ,
              [ven_des] [varchar](100) ,
              [Venta] [decimal](18, 2) ,
              [cantidad] [int]
            )
        
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        V.co_ven, V.ven_des, ROUND(SUM(DV.total_bruto - DV.monto_desc_glob + DV.monto_reca), 2) AS Venta,
                        @iCantidad AS Cantidad
                      FROM
                        saVendedor AS V
                        INNER JOIN saDocumentoVenta AS DV ON DV.co_ven = V.co_ven
                      WHERE
                        ( @dFecha_Emis_d IS NULL
                          OR dbo.FechaSimple(DV.fec_emis) >= @dFecha_Emis_d
                        )
                        AND ( @dFecha_Emis_h IS NULL
                              OR dbo.FechaSimple(DV.fec_emis) <= @dFecha_Emis_h
                            )
                        AND ( ( @sCo_Ven_d IS NULL
                                OR V.co_ven >= @sCo_Ven_d
                              )
                              AND ( @sCo_Ven_h IS NULL
                                    OR V.co_ven <= @sCo_Ven_h
                                  )
                            )
                        AND ( @sCo_Moneda IS NULL
                              OR DV.co_mone = @sCo_Moneda
                            )
                        AND ( @sCo_Sucursal IS NULL
```
