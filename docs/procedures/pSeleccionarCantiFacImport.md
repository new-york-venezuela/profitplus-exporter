# SP: pSeleccionarCantiFacImport
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE			:	pSeleccionarCantiFacImport
DESCRIPCION		:	Procedimiento para conocer las facturas importadas a una devolución
CREADO POR		:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCantiFacImport] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN 
        SELECT
            COUNT(DISTINCT ( num_doc )) AS canti
        FROM
            sadevolucionclientereng
        WHERE
            doc_num = @sDoc_Num
    END
```
