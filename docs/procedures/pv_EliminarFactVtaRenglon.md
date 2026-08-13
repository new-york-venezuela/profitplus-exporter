# SP: pv_EliminarFactVtaRenglon
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: [pv_EliminarFactVtaRenglon]
DESCRIPCION	: ELIMINA UN RENGLON DADO DE UNA FACTURA DADA AL MOMENTO DE REALIZAR UNA DEVOLUCION DE RENGLON DESDE
			  PUNTO DE VENTA
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pv_EliminarFactVtaRenglon]
    (
      @sDocNum			CHAR(20) ,
      @iRengNum			INT ,
      @sCo_Us_Mo		CHAR(6) ,
      @sMaquina			VARCHAR(60) ,
      @sCo_Sucu_Mo		CHAR(6)	
    )
AS 
    BEGIN

		DECLARE @TableTimestamp TABLE
        (
            fe_us_in DATETIME ,
            fe_us_mo DATETIME ,
            rowguid UNIQUEIDENTIFIER
        )

		DECLARE @Co_Alma	CHAR(6)
		DECLARE @Co_Art		CHAR(30) 
		DECLARE @Co_Uni		CHAR(6) 
		DECLARE @Cantidad	DECIMAL(18, 5)

		SELECT @Co_Alma = co_alma,
				@Co_Art = co_art,
				@Co_Uni = co_uni,
				@Cantidad = total_art 
					FROM saFacturaVentaReng
					WHERE   doc_num = @sDocNum
						AND reng_num = @iRengNum
			
			EXEC pEliminarRenglonesFacturaVenta @sDoc_NumOri = @sDocNum, @iReng_NumOri = @iRengNum, @sCo_Us_Mo = @sCo_Us_Mo, @sMaquina = @sMaquina, 
												@sCo_Sucu_Mo = @sCo_Sucu_Mo	
		
			EXEC pStockActualizar @sCo_Alma = @Co_Alma, @sCo_Art = @Co_Art, @sCo_Uni = @Co_Uni, @deCantidad = @Cantidad, @sTipoStock = 'ACT', 
												@bSumarStock = 1, @bPermiteStockNegativo = 1

			UPDATE saFacturaVentaReng SET reng_num = (reng_num - 1) 
				  OUTPUT inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
						INTO @TableTimestamp
				WHERE reng_num > @iRengNum AND doc_num = @sDocNum 
		
		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			DECLARE @sCampos varchar(max)
		   set @sCampos  = ltrim(rtrim(@sDocNum)) +' [TipoDoc:FACT]' + ' [RengNum:'+ltrim(rtrim(@iRengNum))+']'
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saFacturaVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos--@sDocNum
			
            END
	END
```
