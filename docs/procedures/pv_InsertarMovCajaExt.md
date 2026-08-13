# SP: pv_InsertarMovCajaExt
**Tipo**: PV-Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pv_InsertarMovCajaExt]
*DESCRIPCIÓN	: INSERTA UN NUEVO REGISTRO EN LA TABLA 'pvMovimientoCajaExt' ASOCIANDOLO AL TURNO Y NUMERO DE MOVIMIENTO DE CAJA
				  POR MEDIO DEL ROWGUID DEL TURNO Y MOV DE CAJA, SE DISPARA AL INSERTAR UN MOV DE CAJA DESDE PUNTO DE VENTA
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/
CREATE PROCEDURE [dbo].[pv_InsertarMovCajaExt]
    (
		@sNumTurno			CHAR (20),
		@sMovCaja			CHAR (20),
		
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
		@sTrasnfe			CHAR(1) ,
		@sNumeroAJPA		CHAR(20) = NULL
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
        
       DECLARE @rowGuidTurno	UNIQUEIDENTIFIER
       DECLARE @rowGuidMovCaja	UNIQUEIDENTIFIER
	   DECLARE @rowGuidAJPA		UNIQUEIDENTIFIER
              
       SELECT @rowGuidTurno = rowguid FROM pvturnoExe WHERE num_turno = @sNumTurno
	   SELECT @rowGuidMovCaja = rowguid FROM saMovimientoCaja WHERE mov_num = @sMovCaja

	   IF @sNumeroAJPA IS NOT NULL
		 SELECT @rowGuidAJPA = rowguid FROM sadocumentoventa WHERE nro_doc = @sNumeroAJPA and co_tipo_doc = 'AJPA'
		 
     
       INSERT  INTO pvMovimientoCajaExt (rowguid_mov_num, rowguid_num_turno, co_us_in, fe_us_in, co_us_mo, fe_us_mo, rowguid_mov_caj_gen)
			OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
			VALUES (@rowGuidMovCaja, @rowGuidTurno, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @rowGuidAJPA)    
       
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
                EXEC [
```
