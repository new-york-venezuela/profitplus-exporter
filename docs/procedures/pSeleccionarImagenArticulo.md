# SP: pSeleccionarImagenArticulo
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtImagen`](../tables/saArtImagen.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarImagenArticulo
DESCRIPCION: Selecciona la imagen de un articulo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarImagenArticulo]
    (
      @sCo_Art CHAR(30) ,
      @sTip CHAR(6)
    )
AS 
    BEGIN
        SELECT
            [co_art], [tip], [imagen_des], [campo1], [campo2], [campo3], [campo4], [campo5], [campo6], [campo7],
            [campo8], [co_us_in], [co_sucu_in], [fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [revisado], [trasnfe],
            [validador], [rowguid]
        FROM
            saArtImagen
        WHERE
            co_art = @sCo_Art
            AND tip = @sTip
		
    END
```
