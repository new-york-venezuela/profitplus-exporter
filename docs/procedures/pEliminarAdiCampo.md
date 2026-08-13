# SP: pEliminarAdiCampo
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarAdiCampo
*DESCRIPCIÓN	: Elimina un campo adicional
*AUTOR			: SOFTECH SISTEMAS
*Fecha			: 2009-08-18
*************************************************************************/

CREATE PROCEDURE [pEliminarAdiCampo]
    (
      @sCo_AdiCampoOri CHAR(8) ,
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
            saAdiCampo
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_adicampo = @sCo_AdiCampoOri
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
                    @sTablaOri = 'saAdiCampo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_AdiCampoOri
            END
    END
```
