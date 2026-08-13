# SP: RepAnalisisVencerTotalizadoComp
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
CREATE PROCEDURE [RepAnalisisVencerTotalizadoComp]
	-- Add the parameters for the stored procedure here
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @dFecha SMALLDATETIME = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @iDias INT = NULL ,
    @iIncrementoDias INT = NULL ,
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
 
        IF @dFecha IS NOT NULL 
            SET @dFecha = DATEADD(ss, -1, DATEADD(day, 1, @dFecha))

        DECLARE @saldo_venc30_d AS INT
        DECLARE @saldo_venc30_h AS INT
        DECLARE @saldo_venc60_d AS INT
        DECLARE @saldo_venc60_h AS INT
        DECLARE @saldo_venc90_d AS INT
        DECLARE @saldo_venc90_h AS INT
        DECLARE @saldo_venc120_d AS INT
        DECLARE @saldo_venc120_h AS INT
        DECLARE @saldo_venc150_d AS INT
        DECLARE @saldo_venc150_h AS INT
        DECLARE @saldo_venc150_mayor AS INT

	
        IF @iDias IS NULL
            AND @iIncrementoDias IS NULL 
            BEGIN
                SET @iDias = 30
                SET @iIncrementoDias = 30

                SET @saldo_venc30_d = 0
                SET @saldo_venc30_h = @iDias
                SET @saldo_venc60_d = 1 + @iDias 
                SET @saldo_venc60_h = @saldo_venc60_d + @iIncrementoDias - 1
                SET @saldo_venc90_d = 1 + @saldo_venc60_h
                SET @saldo_venc90_h = @saldo_venc90_d + @iIncrementoDias - 1
                SET @saldo_venc120_d = 1 + @saldo_venc90_h
                SET @saldo_venc120_h = @saldo_venc120_d + @iIncrementoDias - 1
                SET @saldo_venc150_d = 1 + @saldo_venc120_h
                SET @saldo_venc150_h = @saldo_venc150_d + @iIncrementoDias - 1
                SET @saldo_venc150_mayor = 1 + @saldo_venc150_h
            END
        IF @iDias IS NOT NULL
            AND @iIncrementoDias IS NOT NULL 
            BEGIN
```
