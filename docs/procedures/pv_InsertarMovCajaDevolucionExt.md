# SP: pv_InsertarMovCajaDevolucionExt
**Tipo**: PV-Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvMovimientoCajaDevolucionExt`](../tables/pvMovimientoCajaDevolucionExt.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pv_InsertarMovCajaDevolucionExt]
*DESCRIPCIÓN	: INSERTA UN NUEVO REGISTRO EN LA TABLA 'pvMovimientoCajaDevolucionExt' UNIENDOLA CON EL 
				  ROWGUID DEL MOV DE CAJA QUE GENERO LA DEVOLUCION
				  Y EL ROWGUID DEL DOCUMENTO GENERADO POR LA MISMA 
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_InsertarMovCajaDevolucionExt]
    (
		@sNroDoc	    CHAR (20),
		@sMovCaja		CHAR (20),
		
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
        
       DECLARE @rowGuidNroDoc	UNIQUEIDENTIFIER
       DECLARE @rowGuidMovCaja	UNIQUEIDENTIFIER
              
       SELECT @rowGuidNroDoc = rowguid FROM saDocumentoVenta WHERE nro_doc = @sNroDoc and co_tipo_doc = 'N/CR'
	   SELECT @rowGuidMovCaja = rowguid FROM saMovimientoCaja WHERE mov_num = @sMovCaja
     
       INSERT  INTO pvMovimientoCajaDevolucionExt (rowguid_mov_num, rowguid_nro_doc, co_us_in, fe_us_in, co_us_mo, fe_us_mo)
			VALUES (@rowGuidMovCaja, @rowGuidNroDoc, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE())    
       
       DECLARE @dtFe_In		DATETIME
       DECLARE @rowGuidOri	UNIQUEIDENTIFIER
       
       SET @dtFe_In			= GETDATE()
       
       SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
       FROM
            @TableTimestamp
                     
        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, 
					@sCo_Sucu = @sCo_Sucu_In, @sTablaOri = 'pvMovimientoCajaDevolucionExt', 
					@rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina
            END
    END
```
