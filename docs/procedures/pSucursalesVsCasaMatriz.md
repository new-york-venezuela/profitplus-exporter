# SP: pSucursalesVsCasaMatriz
**Tipo**: Procedimiento
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSucursalesVsCasaMatriz]
    (
      @sProveedor CHAR(16) = NULL ,
      @sCliente CHAR(16) = NULL ,
      @bTipoDoc BIT 
    )
AS 
    BEGIN
	
        IF @bTipoDoc = '1' -- PAgo
            SELECT
                co_prov
            FROM
                saProveedor
            WHERE
                matriz = @sProveedor
		
        IF @bTipoDoc = '0' -- COBRO
            SELECT
                co_cli
            FROM
                saCliente
            WHERE
                matriz = @sCliente

    END
```
