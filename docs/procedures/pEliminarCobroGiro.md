# SP: pEliminarCobroGiro
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobro`](../tables/saCobro.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pEliminarDocumentoCFXG
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarCobroGiro] ( @sCob_Num CHAR(20) )
AS 
    BEGIN
        DELETE FROM
            saCobro
        WHERE
            cob_num = @sCob_Num 

    END
```
