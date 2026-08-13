# SP: pEliminarUnidadTributaria
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saUnidadTributaria`](../tables/saUnidadTributaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarUnidadTributaria
DESCRIPCION: Dado una unidad tributaria valida si no ha sido alterado mediante el ValidadorOri y la elimina.
CREADO POR: SOFTECH SISTEMAS
FECHA MODIFICACIÓN: <2020-02-18>
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarUnidadTributaria]
    (
      @sdCo_FecOri smalldatetime ,
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
            saUnidadTributaria
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Co_Fec = @sdCo_FecOri
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
                    @sTablaOri = 'saUnidadTributaria', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sdCo_FecOri
            END
	
	
	
    END
```
