# SP: pv_InsertarFacturaReng
**Tipo**: PV-Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`pvParEmp`](../tables/pvParEmp.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_InsertarFacturaReng
*DESCRIPCIÓN	:	INSERTA UN NUEVO RENGLON EN LA TABLa saFacturaventaReng AL AGREGAR RENGLON DESDE PUNTO DE VENTA
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_InsertarFacturaReng]
(
    @iReng_num                  INT, 
    @sDoc_Num                   CHAR(20), 
    @sCo_Art                    CHAR(30),
    @sDes_Art                   CHAR(120),
    @sCo_Uni                    CHAR(6),
    @sCo_Alma                   CHAR(6),
    @sCo_Precio                 CHAR(6),
    @sTipo_Imp                  CHAR(1),
    @deTotal_Art                DECIMAL(18,5),
    @dePrec_Vta                 DECIMAL(18,5),
    @sPorc_Desc                 VARCHAR(15),
    @deMonto_Desc               DECIMAL(18, 5),
    @deReng_Neto                DECIMAL(18,2),
    @deMonto_imp_afec_glob      DECIMAL(18, 5) ,    
    @dePorc_Imp                 DECIMAL(18,5), 
    @deMonto_Imp                DECIMAL(18,5),
    @sComentario                VARCHAR (MAX) ,
    @sCo_Sucu_In                CHAR(6) ,
    @sCo_Us_In                  CHAR(6) ,
    @sRevisado                  CHAR(1) ,
    @sTrasnfe                   CHAR(1) ,
    @sMaquina                   VARCHAR(MAX) = NULL
)
AS
BEGIN
    SET DATEFORMAT dmy

    BEGIN TRY
        -- Iniciar la transacción
        BEGIN TRANSACTION
        	DECLARE @iManejaStockNeg BIT 

			DECLARE @bIsGenerico BIT 

            SELECT @iManejaStockNeg = manejo_stock_negativo from pvParEmp

			select @bIsGenerico = generico from saArticulo where co_art = @sCo_Art 

        -- Llamada a pStockActualizar
        EXEC pStockActualizar @sCo_Alma, @sCo_Art, @sCo_Uni,  @deTotal_Art, 'ACT', 0, @iManejaStockNeg
       
        -- Si pStockActualizar es exitosa, insertar renglones de factura
		

		IF(@bIsGenerico = 0) 
			SET @sDes_Art =  NULL

		
        EXEC dbo.pInsertarRenglonesFacturaVenta 
            @iReng_Num, @sDoc_Num, @sCo_Art, @sDes_Art, @sCo_Uni , 
            NULL, @sCo_Alma , @sCo_Precio, @sTipo_Imp , NULL, 
            NULL, @deTotal_Art , 0.0 , @dePrec_Vta, @sPorc_Desc , 
            @deMonto_Desc , @deReng_Neto , @deTotal_Art , 0.0 , 0.0 , 
            0.0 , 0.0 , 0.0 , 0.0 , @deMonto_imp_afec_glob , 
            0.0 , 0.0 , null , null , NULL , 
            @dePorc_Imp , 0.0 , 0.0 , @deMonto_Imp , 0.0
```
