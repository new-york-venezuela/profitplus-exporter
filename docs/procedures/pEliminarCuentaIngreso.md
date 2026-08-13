# SP: pEliminarCuentaIngreso
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarTablaCta_ingr
DESCRIPCION: Eliminar TablaCta_ingr
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarCuentaIngreso]
    (
      @sCo_Cta_Ingr_EgrOri CHAR(20) ,
      @tsValidador TIMESTAMP = NULL ,
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
            saCuentaIngEgr
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_cta_ingr_egr = @sCo_Cta_Ingr_EgrOri
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
                    @sTablaOri = 'saCuentaIngEgr', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_Cta_Ingr_EgrOri
            END
    END
```
