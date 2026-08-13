# SP: pConvertirCantidadAUnidadBase
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pConvertirCantidadAUnidadBase
DESCRIPCION: Convertir la cantidad a su equivalente en la unidad base del articulo
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 01/06/2010
**************************************************************************************************/
CREATE PROCEDURE [pConvertirCantidadAUnidadBase]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Uni CHAR(6) ,
      @deCantidad DECIMAL(18, 5)
    )
AS 
    BEGIN
	
        SELECT
            ISNULL(dbo.ArtUnidadBase(@sCo_Art, @sCo_Uni, @deCantidad),0)
	
    END
```
