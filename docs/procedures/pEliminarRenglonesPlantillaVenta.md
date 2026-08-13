# SP: pEliminarRenglonesPlantillaVenta
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaVentaReng`](../tables/saPlantillaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesPlanillaVenta
DESCRIPCION	: Elimina un registro de la tabla saPlantillaVentaReng
CREADO POR	: SOFTECH SISTEMAS
FECHA		: 26/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesPlantillaVenta]
    (
      @sDoc_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
	
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saPlantillaVentaReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
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
                    @sTablaOri = 'saPlantillaVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sDoc_NumOri
            END

    END
```
