# SP: pv_SeleccionarArticuloExt
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvArticuloExt`](../tables/pvArticuloExt.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_SeleccionarArticuloExt]
*DESCRIPCIÓN	:	OBTIENE LA INFORMACION ADICIONAL DEL ARTICULO PARA PUNTO DE VENTA DESDE
					EL SISTEMA ADM 8.0
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_SeleccionarArticuloExt]
( 
	@gId uniqueidentifier
)
AS 
    BEGIN
        SELECT
            * FROM pvArticuloExt WHERE Id = @gId
    END
```
