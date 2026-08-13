# SP: pvpEliminarValeAlimentacion
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacion`](../tables/pvValeAlimentacion.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpEliminarValeAlimentacion
*DESCRIPCIÓN	: Elimina una configuracion realizada en la tabla pvValeAlimentacion
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpEliminarValeAlimentacion]
    (
      @sCo_ValeOri CHAR(6) ,
      @tsValidador TIMESTAMP ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL,
      @sMaquina VARCHAR(60) = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            pvValeAlimentacion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_vale = @sCo_ValeOri
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
                    @sTablaOri = 'pvValeAlimentacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                     @sCampos = @sCo_ValeOri
            END
    END
```
