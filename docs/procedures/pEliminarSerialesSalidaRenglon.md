# SP: pEliminarSerialesSalidaRenglon
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	[pEliminarSerialesEntradaRenglon]
*DESCRIPCIÓN	:	Elimina un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarSerialesSalidaRenglon]
    (
      @sTipo_Doc CHAR(4) ,
      @gRowguid UNIQUEIDENTIFIER = NULL -- Id del reglon que representa la entrada del serial

    )
AS 
    BEGIN
        UPDATE
            saSeriales
        SET doc_num_s = NULL, doc_tip_s = NULL
        WHERE
            doc_num_s = @gRowguid
            AND doc_tip_s = @sTipo_Doc
    END
```
