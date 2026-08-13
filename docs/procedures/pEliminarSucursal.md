# SP: pEliminarSucursal
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saSucursal`](../tables/saSucursal.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pEliminarSucursal
*DESCRIPCIÓN	:	Elimina una sucursal
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pEliminarSucursal]
    (
      @sCo_SucurOri CHAR(6) ,
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
            saSucursal
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_sucur = @sCo_SucurOri
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
                    @sTablaOri = 'saSucursal', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_SucurOri
            END

    END
```
