# SP: pEliminarPagoGiro
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pEliminarDocumentoCFXG
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarPagoGiro] ( @sCob_Num CHAR(20) )
AS 
    BEGIN
        DELETE FROM
            saPago
        WHERE
            cob_num = @sCob_Num 

    END
```
