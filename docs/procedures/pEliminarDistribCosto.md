# SP: pEliminarDistribCosto
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE		: pEliminarDistribCosto
*DESCRIPCIN : Elimina un encabezado de distribucion de costos
*AUTOR		: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarDistribCosto]
    (
      @sDistrib_NumOri CHAR(20) ,
      @tsValidador TIMESTAMP,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

		-- PRIMERA LISTA
		DECLARE @RengNum INT
		DECLARE Renglones_Cursor1 CURSOR LOCAL FORWARD_ONLY

		FOR
        SELECT
            ACGR.[reng_num]
        FROM
            saDistribCostoDestinoReng AS ACGR
        WHERE
            ACGR.distrib_num = @sDistrib_NumOri
        ORDER BY
            reng_num

		OPEN Renglones_Cursor1
        FETCH NEXT FROM Renglones_Cursor1 INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesDistribCostoDestino] @sDistrib_NumOri = @sDistrib_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor1 INTO @RengNum
            END	
        CLOSE Renglones_Cursor1
        DEALLOCATE Renglones_Cursor1
		
		-- SEGUNDA LISTA
		DECLARE Renglones_Cursor2 CURSOR LOCAL FORWARD_ONLY

		FOR
        SELECT
            ACGR.[reng_num]
        FROM
            saDistribCostoOrigenReng AS ACGR
        WHERE
            ACGR.distrib_num = @sDistrib_NumOri
        ORDER BY
            reng_num

		OPEN Renglones_Cursor2
        FETCH NEXT FROM Renglones_Cursor2 INTO @RengNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                EXEC [dbo].[pEliminarRenglonesDistribCostoOrigen] @sDistrib_NumOri = @sDistrib_NumOri, @iReng_NumOri = @RengNum,
                    @sMaquina = @sMaquina, @sCo_Us_Mo = @sCo_Us_Mo, @sCo_Sucu_Mo = @sCo_Sucu_Mo

                FETCH NEXT FROM Renglones_Cursor2 INTO @RengNum
            END	
        CLOSE Renglones_Cursor2
        DEALLOCATE Renglones_Cursor2

			-----
		DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saDistribCosto
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
```
