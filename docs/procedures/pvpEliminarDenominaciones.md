# SP: pvpEliminarDenominaciones
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpEliminarDenominaciones
*DESCRIPCIÓN	: Elimina un registro en la tabla de denominaciones
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpEliminarDenominaciones]
    (
      @sCo_ValeOri CHAR(6) ,
      --@deValorOri DECIMAL (18,2),
      @iRENG_NUMOri INT ,
	  --@bInactivo BIT, 
      @sCo_Us_Mo CHAR(6)= NULL ,
      @sMaquina VARCHAR(60)= NULL ,
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
            pvValeAlimentacionReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Vale = @sCo_ValeOri
			AND reng_num = @iRENG_NUMOri    	

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
                    @sTablaOri = 'pvValeAlimentacionReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_ValeOri
            END


    END
```
