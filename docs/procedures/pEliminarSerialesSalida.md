# SP: pEliminarSerialesSalida
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

CREATE PROCEDURE [dbo].[pEliminarSerialesSalida]
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
		

        UPDATE
            saSeriales
        SET doc_num_s = NULL, doc_tip_s = NULL
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid = @gRowguid
            AND doc_num_s IS NOT NULL


		-- Valido que no queden seriales con salidad
        SELECT
            ISNULL(COUNT(*), 0) AS cantidad
        FROM
            saSeriales
        WHERE
            doc_num_e = @gRowguid
    END
```
