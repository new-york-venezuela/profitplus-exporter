# SP: pEliminarOrdenPagoRenglon
**Tipo**: Eliminar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pEliminarOrdenPagoRenglon]
DESCRIPCION: Procedimiento para eliminar un registro de la tabla  saOrdenPagoReng
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarOrdenPagoRenglon]
    (
      @sOrd_NumOri CHAR(20) ,
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
            saOrdenPagoReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            ord_num = @sOrd_NumOri
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
                    @sCampos = @sOrd_NumOri		  
            END
			  
    END
```
