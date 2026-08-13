# SP: RepClienteMasVenta
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-10-10>
-- Description:	<Clientes con mas Ventas>
-- =============================================
CREATE PROCEDURE [RepClienteMasVenta]
    @dFecha_Emis_d SMALLDATETIME = NULL ,
    @dFecha_Emis_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @iCantidad INT = NULL ,
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
              [co_cli] [char](16) ,
              [cli_des] [varchar](100) ,
              [Venta] [decimal](18, 2) ,
              [cantidad] [int]
            )
        
        INSERT  INTO @temp
                SELECT
                    *
                FROM
                    ( SELECT TOP ( @iCantidad )
                        C.co_cli, C.cli_des, ROUND(SUM(DV.total_bruto - DV.monto_desc_glob + DV.monto_reca), 2) AS Venta,
                        @iCantidad AS Cantidad
                      FROM
                        saCliente AS C
                        INNER JOIN saDocumentoVenta AS DV ON DV.co_cli = C.co_cli
                      WHERE
                        ( ( @dFecha_Emis_d IS NULL
                            OR dbo.FechaSimple(DV.fec_emis) >= @dFecha_Emis_d
                          )
                          AND ( @dFecha_Emis_h IS NULL
                                OR dbo.FechaSimple(DV.fec_emis) <= @dFecha_Emis_h
                              )
                        )
                        AND ( ( @sCo_Cli_d IS NULL
                                OR C.co_cli >= @sCo_Cli_d
                              )
                              AND ( @sCo_Cli_h IS NULL
                                    OR C.co_cli <= @sCo_Cli_h
                                  )
                            )
                        AND ( @sCo_Moneda I
```
