# SP: pEliminarContabilizacion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarContabilizacion
DESCRIPCION: Dado una Contabilizacion valida si no ha sido alterado mediante el ValidadorOri y lo elimina.
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarContabilizacion]
    (
      @sInte_NumOri CHAR(20) ,
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
            saIntegr
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            inte_num = @sInte_NumOri
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
                    @sTablaOri = 'saIntegr', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sInte_NumOri
            END
    END
```
