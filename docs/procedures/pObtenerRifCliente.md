# SP: pObtenerRifCliente
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerRifCliente
DESCRIPCION: Verifica si ya existe un rif en la tabla saCliente igual al que se va a
			ingresar
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerRifCliente] ( @sRif CHAR(18) )
AS 
    BEGIN	

        DECLARE @bExiste BIT

        IF EXISTS ( SELECT
                        rif, co_cli
                    FROM
                        saCliente
                    WHERE
                        rif = @sRif ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0
        SELECT
            @bExiste AS Existe
    END
```
