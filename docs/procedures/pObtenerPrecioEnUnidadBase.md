# SP: pObtenerPrecioEnUnidadBase
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerPrecioEnUnidadBase]
DESCRIPCION: Convertir el precio del articulo al precio en unidad base
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerPrecioEnUnidadBase]
    (
      @sCo_Art CHAR(30) ,
      @sCod_Uni CHAR(6) ,
      @dePrecio DECIMAL(18, 5)
    )
AS 
    BEGIN	

        SELECT
            ROUND(@dePrecio / dbo.ArtUnidadBase(@sCo_Art, @sCod_Uni, 1), 2)
	
    END
```
