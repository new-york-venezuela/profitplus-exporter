# SP: pEliminarRegla
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRegla
DESCRIPCION: Elimina una regla de integración
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRegla]
    (
      @sCo_RegOri CHAR(10) ,
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
            saReglaInt
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_reg = @sCo_RegOri
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
                    @sTablaOri = 'saReglaInt', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_RegOri
            END
    END
```
