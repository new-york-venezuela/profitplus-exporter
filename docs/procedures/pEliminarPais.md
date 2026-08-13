# SP: pEliminarPais
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPais`](../tables/saPais.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pEliminarPais
*DESCRIPCIÓN	: Elimina un pais
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [pEliminarPais]
    (
      @sCo_PaisOri CHAR(6) ,
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
            saPais
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_pais = @sCo_PaisOri
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
                    @sTablaOri = 'saPais', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_PaisOri
            END
		
    END
```
