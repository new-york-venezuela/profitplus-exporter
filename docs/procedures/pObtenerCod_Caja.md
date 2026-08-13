# SP: pObtenerCod_Caja
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerCod_Caja
DESCRIPCION: Selecciona un COBRO
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerCod_Caja]
AS 
    BEGIN
        SELECT
            cod_caja
        FROM
            saCaja
		
    END
```
