# SP: pEliminarTabuladorIslr
**Tipo**: Eliminar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saTabuladorIslr`](../tables/saTabuladorIslr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pEliminarTabuladorIslr]
DESCRIPCION: Procedimiento para eliminar un registro de la tabla  saTabuladorIslr
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarTabuladorIslr]
    (
      @sCo_TabOri CHAR(20) ,
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
            saTabuladorIslr
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tab = @sCo_TabOri
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
                    @sTablaOri = 'saTabuladorIslr', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_TabOri		  
            END
			  
    END
```
