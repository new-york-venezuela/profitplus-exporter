# SP: pEliminarComisionPrecioLinea
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionPrecioLinea`](../tables/saComisionPrecioLinea.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarComisionPrecioLinea
*DESCRIPCIÓN	: Elimina una Comisión de Nivel de Precio por Linea
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarComisionPrecioLinea]
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
            saComisionPrecioLinea
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
                    @sTablaOri = 'saComisionPrecioLinea', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCo_ComipOri
            END
    END
```
