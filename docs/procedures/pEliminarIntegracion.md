# SP: pEliminarIntegracion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarIntegracion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarIntegracion]
    (
      @iInte_NumOri INT ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL
	
    )
AS 
    BEGIN
        DELETE FROM
            saIntegr
        WHERE
            inte_num = @iInte_NumOri
            AND validador = @tsValidador
    END
```
