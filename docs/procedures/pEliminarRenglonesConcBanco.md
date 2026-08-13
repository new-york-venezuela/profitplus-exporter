# SP: pEliminarRenglonesConcBanco
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConcBanco`](../tables/saConcBanco.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarRenglonesConcBanco
*DESCRIPCIÓN : Elimina un registro de la tabla saConcBanco
*AUTOR : SOFTECH SISTEMAS.
*MODIFICADO: 
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesConcBanco]
    (
      @sCo_Auto_ConOri CHAR(6) ,
      @iRENG_NUMOri INT ,
      @sMov_NumOri CHAR(20) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL)
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            [saConcBanco]
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_auto_con = @sCo_Auto_ConOri
            AND mov_num = @sMov_NumOri			

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
                    @sTablaOri = 'saConcBanco', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Auto_ConOri
            END
    END
```
