# SP: pStockActualizar
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saStockAlmacen`](../tables/saStockAlmacen.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pStockActualiza]
*DESCRIPCIÓN	: Sumar o Resta stock en la tabla stock por almacen
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2009-07-14
**************************************************************************/

CREATE PROCEDURE [pStockActualizar]
    (
      @sCo_Alma CHAR(6) ,
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @deCantidad DECIMAL(18, 5) ,
      @sTipoStock CHAR(4) ,
      @bSumarStock BIT ,
      @bPermiteStockNegativo BIT
    )
AS 
    BEGIN	

        DECLARE @intResultado INTEGER
        DECLARE @deStockFinal DECIMAL(18, 5)
        DECLARE @TableResultStock TABLE
            (
              stockFinal DECIMAL(18, 5)
            )
        DECLARE @MensajeError VARCHAR(256)

        IF ( @bSumarStock = 0 ) 
            SET @deCantidad = @deCantidad * -1.00000

	-- Se convierte el valor a la unidad principal o base
	
        SET @deCantidad = dbo.ArtUnidadBase(@sCo_Art, @sCo_Uni, @deCantidad)
	
	
	
        IF ( @deCantidad IS NULL ) 
            BEGIN
                SET @MensajeError = 'No existe relación artículo/unidad para el artículo "' + RTRIM(@sCo_Art)
                    + '" y unidad "' + RTRIM(@sCo_Uni) + '".'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END

        IF ( @sTipoStock != 'SACT'
             AND @sTipoStock != 'ACT'
             AND @sTipoStock != 'SLLE'
             AND @sTipoStock != 'LLE'
             AND @sTipoStock != 'SCOM'
             AND @sTipoStock != 'COM'
             AND @sTipoStock != 'SDES'
             AND @sTipoStock != 'DES'
           ) 
            BEGIN	
                SET @MensajeError = 'El tipo de stock "' + @sTipoStock
                    + '" no es válido para las operaciones de Sumar/Restar Stock'
                RAISERROR(@MensajeError,16,1)
                RETURN ;
            END


        DECLARE @TranCounter INT ;
        SET @TranCounter = @@TRANCOUNT ;
        IF @TranCounter > 0
        -- Procedure called when there is an active transaction. Create a savepoint to be able to roll back only the work done in the procedure if there is an error.
            SAVE TRANSACTION TransacStock ;
        ELSE
        -- Procedure must start its own transaction.
            BEGIN TRANSACTION TransacStock ;


        UPDATE
            saStockAlmacen
        SET saStockAlmacen.stock = saStock
```
