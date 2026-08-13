# SP: pEliminarComisionPrecioCategoria
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioCategoria`](../tables/saComisionPrecioCategoria.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarComisionPrecioCategoria
*DESCRIPCIÓN	: Elimina una Comisión de Nivel de Precio por Categoria
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarComisionPrecioCategoria]
    (
      @sCo_ComipOri CHAR(6) ,
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
            saComisionPrecioCategoria
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_comip = @sCo_ComipOri
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
                    @sTablaOri = 'saComisionPrecioCategoria', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCo_ComipOri
            END
    END
```
