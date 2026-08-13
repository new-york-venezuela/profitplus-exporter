# SP: pv_InsertarFacturaVentaExt
**Tipo**: PV-Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pv_InsertarFacturaVentaExt]
*DESCRIPCIÓN	: INSERTA UN NUEVO REGISTRO EN LA TABLA 'pvFacturaVentaExt' AL MOMENTO DE INICIAR
				  UNA FACTURA DESDE PUNTO DE VENTA
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [dbo].[pv_InsertarFacturaVentaExt]
    (
		@sCodigoTurno		CHAR (20),
		@sFactNum			CHAR (20),
		@estado				CHAR (1),
	
		@sCampo1			VARCHAR(60) = NULL ,
		@sCampo2			VARCHAR(60) = NULL ,
		@sCampo3			VARCHAR(60) = NULL ,
		@sCampo4			VARCHAR(60) = NULL ,
		@sCampo5			VARCHAR(60) = NULL ,
		@sCampo6			VARCHAR(60) = NULL ,
		@sCampo7			VARCHAR(60) = NULL ,
		@sCampo8			VARCHAR(60) = NULL ,
		@sCo_Us_In			CHAR(6) ,
		@sCo_Sucu_In		CHAR(6) ,
		@sMaquina			VARCHAR(60) = NULL ,
		@sRevisado			CHAR(1) ,
		@sTrasnfe			CHAR(1)
    )
AS 
    BEGIN
		 DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

			DECLARE @rowGuidFact UNIQUEIDENTIFIER
			DECLARE @rowGuidTurno UNIQUEIDENTIFIER
	  
			SELECT @rowGuidTurno = rowguid FROM pvturnoExe WHERE num_turno = @sCodigoTurno
			SELECT @rowGuidFact = rowguid FROM safacturaventa WHERE doc_num = @sFactNum

			INSERT INTO pvFacturaVentaExt(rowguid_doc_num, rowguid_num_turno, estado, co_us_in, co_us_mo, fe_us_in, fe_us_mo) 
				OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
						VALUES (@rowGuidFact, @rowGuidTurno,  @estado, @sCo_Us_In, @sCo_Us_In, GETDATE(), GETDATE())
    
			DECLARE @dtFe_In		DATETIME
			DECLARE @rowGuidOri		UNIQUEIDENTIFIER
       
			SET @dtFe_In = GETDATE()
       
			SELECT
				@dtFe_In = fe_us_in, @rowGuidOri = rowguid
			FROM
				@TableTimestamp
                     
			IF @dtFe_In IS NOT NULL 
				BEGIN
				-- Insertar Pista
					EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, 
						@sCo_Sucu = @sCo_Sucu_In, @sTablaOri = 'pvFacturaVentaExt', 
						@rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina
				END
    END
```
