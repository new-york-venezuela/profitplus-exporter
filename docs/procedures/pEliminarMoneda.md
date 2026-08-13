# SP: pEliminarMoneda
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarTablaMoneda
DESCRIPCION: Eliminar Tabla Moneda
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarMoneda]
    (
      @sCo_MoneOri CHAR(6) ,
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
            saMoneda
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_mone = @sCo_MoneOri
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
                    @sTablaOri = 'saMoneda', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_MoneOri
            END
    
    END
```
