# SP: pValidarFacturaContabilizada
**Tipo**: Validar
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompra`](../tables/saFacturaCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pValidarFacturaDistribuida
DESCRIPCION:	Procedimiento que valida si una factura ha sido distribuida
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarFacturaContabilizada]
    @sDoc_num CHAR(20)
AS 
    BEGIN
		
		DECLARE @bValido BIT
		SET @bValido = 0		
		IF EXISTS (SELECT	doc_num
		FROM	saFacturaCompra					
		WHERE	doc_num = @sDoc_num AND numcom IS NULL)
			BEGIN 
				SET @bValido = 1
			END				
        SELECT @bValido as valido

    END
```
