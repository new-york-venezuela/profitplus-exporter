# SP: pActualizarLote
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pLoteActualizar]
*DESCRIPCIÓN	: Sumar o Resta lote en la tabla saLoteEntrada
*AUTOR			: Softech Sistemas
*FECHA			: 2009-10-05
**************************************************************************/

CREATE PROCEDURE [pActualizarLote]
    (
      @gRowguid UNIQUEIDENTIFIER ,
      @sNumero_Lote CHAR(20) ,
      @deCantidad DECIMAL(18, 5) ,
      @bPermiteStockNegativo BIT ,
      @bSumarStock BIT
    )
AS 
    BEGIN	

        DECLARE @intResultado INTEGER
        DECLARE @deStockFinal DECIMAL(18, 5)
        DECLARE @TableResultLote TABLE ( loteFinal DECIMAL(18, 5) )
        DECLARE @MensajeError VARCHAR(256)
	
        IF ( @bSumarStock = 0 ) 
            SET @deCantidad = @deCantidad * -1.00000

        BEGIN TRANSACTION
        UPDATE
            saLoteEntrada
        SET saLoteEntrada.stock_actual = saLoteEntrada.stock_actual + @deCantidad
        OUTPUT
            inserted.stock_actual
            INTO @TableResultLote
        WHERE
            saLoteEntrada.rowguid = @gRowguid
	
        SELECT TOP 1
            @deStockFinal = loteFinal
        FROM
            @TableResultLote

        IF ( @bSumarStock = 0
             AND @bPermiteStockNegativo = 0
             AND @deStockFinal < 0
           ) 
            BEGIN
                ROLLBACK
		
                SET @MensajeError = 'No existe stock para el lote "' + RTRIM(@sNumero_Lote) + '"'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END
        COMMIT
        SELECT
            loteFinal
        FROM
            @TableResultLote
    END
```
