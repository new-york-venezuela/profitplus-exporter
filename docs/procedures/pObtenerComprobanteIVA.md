# SP: pObtenerComprobanteIVA
**Tipo**: Obtener
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/***********************************************************************************************************************************
NOMBRE:			[pObtenerComprobanteIVA]
DESCRIPCION:	Obtener el número de comprobante de IVA
CREADO POR:		SOFTECH SISTEMAS
FECHA:			20/09/2010
***********************************************************************************************************************************/

CREATE PROCEDURE [pObtenerComprobanteIVA]
    @sdFecha SMALLDATETIME ,
    @besVenta BIT
AS 
    BEGIN
	
        DECLARE @fecha SMALLDATETIME
        DECLARE @tempComprobante VARCHAR(14)
        DECLARE @sig INT
        DECLARE @anhoMes VARCHAR(6)
        DECLARE @ultComprobante VARCHAR(14)

        IF ( @sdFecha IS NULL ) 
            SET @fecha = GETDATE()
        ELSE 
            SET @fecha = @sdFecha

        IF ( @besVenta = 0 ) 
            SELECT
                @tempComprobante = MAX(RIGHT(num_comprobante, 6))
            FROM
                saDocumentoCompra
            WHERE
                LEN(num_comprobante) = 14
                AND ISNUMERIC(RIGHT(num_comprobante, 6)) = 1
        ELSE 
            SELECT
                @tempComprobante = MAX(RIGHT(num_comprobante, 6))
            FROM
                saDocumentoVenta
            WHERE
                LEN(num_comprobante) = 14
                AND ISNUMERIC(RIGHT(num_comprobante, 6)) = 1
		
	-- No existe Comprobante
        IF ( @tempComprobante IS NULL ) 
            SET @tempComprobante = '0'
	
	-- Reiniciar el contador
        IF @tempComprobante = '99999999' 
            SET @tempComprobante = '0'

	-- TEST
	--SET @tempComprobante = '00899999'

        SET @sig = CAST(@tempComprobante AS INT) + 1
        SET @anhoMes = CAST(DATEPART(YEAR, @fecha) AS VARCHAR) + ( REPLICATE('0', 2 - LEN(DATEPART(MONTH, @fecha)))
                                                                   + CAST(DATEPART(MONTH, @fecha) AS VARCHAR) )

        SELECT
            @ultComprobante = ( @anhoMes + REPLICATE('0', 8 - LEN(@sig)) + CAST(@sig AS VARCHAR) )

        SELECT
            @ultComprobante AS NumeroComprobanteIVA
    END
```
