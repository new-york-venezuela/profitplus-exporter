# SP: pObtenerRifProveedor
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerRifProveedor
DESCRIPCION: Verifica si ya existe un rif en la bd igual al que se esta ingresando
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerRifProveedor] ( @sRif CHAR(18) )
AS 
    BEGIN	

        DECLARE @bExiste BIT

        IF EXISTS ( SELECT
                        rif, co_prov
                    FROM
                        saProveedor
                    WHERE
                        rif = @sRif
                        AND nacional = 1 ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0

        SELECT
            @bExiste AS Existe

    END
```
