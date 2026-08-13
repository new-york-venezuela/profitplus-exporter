# SP: pEliminarRenglonesPedidoVenta
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saPedidoVentaReng`](../tables/saPedidoVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pEliminarRenglonesPedidoVenta
DESCRIPCION	: Elimina un registro de la tabla saPedidoVentaReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesPedidoVenta]
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
            saPedidoVentaReng
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
                    @sTablaOri = 'saPedidoVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sDoc_NumOri
            END

    END
```
