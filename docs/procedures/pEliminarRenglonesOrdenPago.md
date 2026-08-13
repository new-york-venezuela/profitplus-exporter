# SP: pEliminarRenglonesOrdenPago
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarOrdenPago
DESCRIPCION	: Elimina un registro de la tabla saOrdenPagoReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesOrdenPago]
    (
      @sOrd_NumOri CHAR(20) ,
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
            saOrdenPagoReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            ord_num = @sord_numOri
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
                    @sTablaOri = 'saOrdenPagoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sord_numOri
            END

    END
```
