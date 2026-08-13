# SP: pEliminarTransferenciaEntreCuentas
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pEliminarTransferenciaEntreCuentas
*DESCRIPCIÓN	:	Elimina una trasnferencia entre cuentas
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarTransferenciaEntreCuentas]
    (
      @sco_trans_banOri CHAR(20) ,
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
            saTransferenciaEntreCuentas
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_trans_ban = @sco_trans_banOri
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
                    @sTablaOri = 'saTransferenciaEntreCuentas', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sco_trans_banOri
            END

    END
```
