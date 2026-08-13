# SP: pEliminarSerialesEntradaAlReversar
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/*********************************************************************************************************
*AUTOR		:	SOFTECH SISTEMAS
*DESCRIPCION:	Eliminar los seriales al reversar un documento
*FECHA		:	21/07/2010
*********************************************************************************************************/


CREATE PROCEDURE [pEliminarSerialesEntradaAlReversar]
    (
      @gRowguid UNIQUEIDENTIFIER ,
      @sDoc_Tip_E CHAR(4)
    )
AS 
    BEGIN

        DELETE FROM
            saSeriales
        WHERE
            doc_num_e = @gRowguid
            AND doc_tip_s IS NULL
            AND doc_num_s IS NULL
            AND doc_tip_e = @sDoc_Tip_E

    END
```
