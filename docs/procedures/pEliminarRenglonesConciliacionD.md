# SP: pEliminarRenglonesConciliacionD
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarRenglonesConciliacionD
*DESCRIPCIÓN : Elimina un registro de la tabla saConciliacionDetalle
*AUTOR : SOFTECH SISTEMAS.
*MODIFICADO: 
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesConciliacionD]
    (
      @sCo_Auto_ConOri CHAR(6) ,
      @iRENG_NUMOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            saConciliacionDetalle
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_auto_con = @sCo_Auto_ConOri
            AND reng_num = @iRENG_NUMOri

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
                    @sTablaOri = 'saConciliacionDetalle', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCo_Auto_ConOri
            END
    END
```
