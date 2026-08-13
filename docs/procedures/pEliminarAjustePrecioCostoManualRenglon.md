# SP: pEliminarAjustePrecioCostoManualRenglon
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoReng`](../tables/saAjPrecioCostoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pEliminarPrecioCostoManualRenglon
DESCRIPCION:	Elimina un renglon del Ajuste de precio/costo Manual
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarAjustePrecioCostoManualRenglon]
    (
      @sCod_AjusteOri CHAR(20) ,
      @iReng_NumOri INT ,
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
            saAjPrecioCostoReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_ajuste = @sCod_AjusteOri
            AND reng_num = @iReng_NumOri
		  
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
                    @sTablaOri = 'saAjPrecioCostoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sCod_AjusteOri
            END
    END
```
