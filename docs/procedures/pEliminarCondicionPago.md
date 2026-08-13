# SP: pEliminarCondicionPago
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarCondicionPago
DESCRIPCION: Eliminar Condición Pago
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarCondicionPago]
    (
      @sCo_CondOri CHAR(6) ,
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
            saCondicionPago
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_cond = @sCo_CondOri
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
                    @sTablaOri = 'saCondicionPago', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_CondOri
            END
    
    END
```
