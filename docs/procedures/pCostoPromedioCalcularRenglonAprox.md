# SP: pCostoPromedioCalcularRenglonAprox
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoPromedioCalcularRenglonAprox]
    (
      @strUsuario CHAR(6) = 'N/D' ,
      @strMaquina CHAR(60) = 'N/D' ,
      @strCoSucu CHAR(6) = 'N/D',
         @RowGuid_Doc_Orig UNIQUEIDENTIFIER,
         @bTipo Bit
    )
AS 
    BEGIN

        SET NOCOUNT ON

        DECLARE @ArticuloActual                 AS UNIQUEIDENTIFIER
        DECLARE @AlmacenActual                  AS CHAR(6)
        DECLARE @StockActual                    AS DECIMAL(18, 5)
        DECLARE @StockProcesarActual            AS DECIMAL(18, 5)
        DECLARE @CostoPromedioActual            AS DECIMAL(18, 5)


             if (@bTipo = 1) -- Salida
                    Select @ArticuloActual = cod_articulo_rowguid, @AlmacenActual = cod_almacen from saCostoHistoricoSalida where doc_orig = @RowGuid_Doc_Orig
             ELSE
                    Select @ArticuloActual = cod_articulo_rowguid, @AlmacenActual = cod_almacen from saCostoHistoricoEntrada where doc_orig = @RowGuid_Doc_Orig

        DECLARE @TablaMovimientoInventario TABLE
            (
                      [IdNum] int IDENTITY(1,1),
              [Id] [uniqueidentifier] PRIMARY KEY,
              [Fecha] [datetime] ,
              [Cantidad] [decimal](18, 5) ,
              [CantidadProcesada] [decimal](18, 5) ,
              [Costo] [decimal](18, 5) ,
              [Procesado] [bit] ,
              [Tipo] [char](1) ,
              [RengNum] [int], 
                      [Fecha2] [datetime],
                      [IdDocOrig] [uniqueidentifier]
            )

             DECLARE @IdNum              AS INT
        DECLARE @Id                 AS UNIQUEIDENTIFIER
        DECLARE @Fecha              AS DATETIME
        DECLARE @Cantidad           AS DECIMAL(18, 5)
        DECLARE @CantidadProcesada  AS DECIMAL(18, 5)
        DECLARE @Costo              AS DECIMAL(18, 5)
        DECLARE @Procesado          AS BIT
        DECLARE @Tipo               AS CHAR(1)
        DECLARE @RengNum            AS INT
        DECLARE @Fecha2             AS DATETIME
             DECLARE @IdDocOrig                AS UNIQUEIDENTIFIER
              
        SET @StockActual = 0
        SET @CostoPromedioActual = 0
             SET @StockProcesarActual = 0

        INSERT  INTO @TablaMovimientoInventario
                SELECT
                    E.cod_costo_historico_entrada as id, E.fecha_emision, E.cantidad, 0 AS Procesado, E.costo, 0, 'E' as tipo,
                    E.re
```
