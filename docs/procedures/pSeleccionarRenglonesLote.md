# SP: pSeleccionarRenglonesLote
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	pSeleccionarRenglonLote
DESCRIPCION	:	Procedimiento para seleccionar todos los lotes asociados a un documento
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesLote]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER
	
    )
AS 
    BEGIN

        SELECT
            *
        FROM
            saLoteEntrada
        WHERE
            rowguid_reng = @gRowguid_Reng
				
	
    END
```
