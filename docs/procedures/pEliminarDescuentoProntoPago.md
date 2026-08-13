# SP: pEliminarDescuentoProntoPago
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDescProntoPago`](../tables/saDescProntoPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarTablaDppago
DESCRIPCION: Eliminar Tabla Dppago
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarDescuentoProntoPago]
    (
      @sCo_DescOri CHAR(6) ,
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
            saDescProntoPago
        WHERE
            co_desc = @sCo_DescOri
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
                    @sTablaOri = 'saDescProntoPago', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_DescOri    
            END    
    END
```
