# SP: pEliminarRenglonesCheque
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarCheque
*DESCRIPCIÓN : Elimina un Cheque
*AUTOR : SOFTECH SISTEMAS
*MODIFICADO: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesCheque]
    (
      @iReng_NumOri INT = NULL ,
      @sCo_CheqOri CHAR(20) ,
      @sCo_ChraOri CHAR(6) ,
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
            saCheque
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_cheq = @sCo_CheqOri
            AND co_chra = @sCo_ChraOri

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
                    @sTablaOri = 'saCheque', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_CheqOri
            END
    END
```
