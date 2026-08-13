# SP: pEliminarSerialesEntrada
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pEliminarSeriales
*DESCRIPCIÓN	:	Elimina un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pEliminarSerialesEntrada]
    (
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @iRENG_NUMOri INT = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
        DELETE FROM
            saSeriales
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid = @gRowguid
            AND doc_num_s IS NULL

    END
```
