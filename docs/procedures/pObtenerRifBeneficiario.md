# SP: pObtenerRifBeneficiario
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerRifCliente
DESCRIPCION: Verifica si ya existe un rif en la tabla saCliente igual al que se va a
                     ingresar
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerRifBeneficiario]
	( 
		@sRif CHAR(18)
	)
AS 
    BEGIN     
        DECLARE @bExiste BIT
        IF EXISTS ( SELECT
                        rif
                    FROM
                        saBeneficiario
                    WHERE
                        rif = @sRif ) 
            SET @bExiste = 1
        ELSE 
            SET @bExiste = 0
        SELECT
            @bExiste AS Existe
    END
```
