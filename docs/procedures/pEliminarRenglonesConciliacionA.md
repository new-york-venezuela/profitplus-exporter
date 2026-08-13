# SP: pEliminarRenglonesConciliacionA
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarRenglonesConciliacionA
*DESCRIPCIÓN : Elimina un registro de la tabla saConciliacionAutoReng
*AUTOR : SOFTECH SISTEMAS
*MODIFICADO: 
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesConciliacionA]
    (
      @iReng_NumOri INT ,
      @sCo_Auto_ConOri CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            [saConciliacionAutoReng]
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_auto_con = @sCo_Auto_ConOri

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
                    @sTablaOri = 'saConciliacionAutoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCo_Auto_ConOri
            END
    END
```
