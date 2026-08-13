# SP: RepAnalisisVencimientoComp
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22-09-10>
-- Description:	<Analisis de Vencimiento Compras>
-- =============================================
CREATE PROCEDURE [RepAnalisisVencimientoComp]
	-- Add the parameters for the stored procedure here
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @dFecha SMALLDATETIME = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @iDias DECIMAL(18, 2) = NULL ,
    @iIncrementoDias DECIMAL(18, 2) = NULL ,
    @sCo_Tip CHAR(6) = NULL ,
    @bCondic BIT = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha IS NULL 
            SET @dFecha = GETDATE()

	    SET @dFecha = CONVERT(date, @dFecha, 103)
        
        IF @dFecha IS NOT NULL 
           SET @dFecha = DATEADD(mi, -1, DATEADD(day, 1, @dFecha))

        DECLARE @saldo_venc30_d AS DECIMAL(18, 2)
        DECLARE @saldo_venc30_h AS DECIMAL(18, 2)
        DECLARE @saldo_venc60_d AS DECIMAL(18, 2)
        DECLARE @saldo_venc60_h AS DECIMAL(18, 2)
        DECLARE @saldo_venc90_d AS DECIMAL(18, 2)
        DECLARE @saldo_venc90_h AS DECIMAL(18, 2)
        DECLARE @saldo_venc90_mayor AS DECIMAL(18, 2)
	
        IF @iDias IS NULL
            AND @iIncrementoDias IS NULL 
            BEGIN
                SET @iDias = 30.00
                SET @iIncrementoDias = 30.00

                SET @saldo_venc30_d = 0
                SET @saldo_venc30_h = @iDias
                SET @saldo_venc60_d = 1 + @iDias 
                SET @saldo_venc60_h = @saldo_venc60_d + @iIncrementoDias - 1
                SET @saldo_venc90_d = 1 + @saldo_venc60_h
                SET @saldo_venc90_h = @saldo_venc90_d + @iIncrementoDias - 1
                SET @saldo_venc90_mayor = 1 + @saldo_venc90_h
            END
        IF @iDias IS NOT NULL
            AND @iIncrementoDias IS NOT NULL 
            BEGIN	
                SET @saldo_venc30_d = 0
                SET @saldo_venc30_h = @iDias
                SET @saldo_venc60_d = 1 + @iDias
                SET @saldo_venc60_h = @saldo_venc60_d + @iIncrementoDias - 1
                SET @saldo_venc90_d = 1 + @saldo_venc60_h
                SET @saldo_venc
```
