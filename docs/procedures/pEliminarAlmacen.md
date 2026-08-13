# SP: pEliminarAlmacen
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarSubAlmacen
*DESCRIPCIÓN	: Elimina un Sub-Almacen
*AUTOR			: SOFTECH SISTEMAS 
*************************************************************************/

CREATE PROCEDURE [pEliminarAlmacen]
    (
      @sCo_AlmaOri CHAR(6) ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL

    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saAlmacen
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_alma = @sCo_AlmaOri
            AND validador = @tsValidador	


        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saAlmacen', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_AlmaOri
            END

    END
```
