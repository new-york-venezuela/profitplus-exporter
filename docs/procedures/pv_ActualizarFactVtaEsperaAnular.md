# SP: pv_ActualizarFactVtaEsperaAnular
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ActualizarFactVtaEsperaAnular]
*DESCRIPCIÓN	: ANULA UNA FACTURA EN ESPERA, ACTUALIZA SU DOCUMENTO Y EL STOCK ASOCIADO A LA MISMA.
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarFactVtaEsperaAnular]
(
	@string				CHAR(20),
	@sCo_Us_Mo			CHAR(6) ,
	@sCo_Sucu_Mo		CHAR(6)				=	NULL ,
	@sMaquina			VARCHAR(60)			=	NULL ,
	@sCampos			VARCHAR(MAX)		=	NULL ,
	@sRevisado			CHAR(1) ,
	@sTrasnfe			CHAR(1) ,
	@tsValidador		TIMESTAMP			=	NULL ,
	@gRowguid			UNIQUEIDENTIFIER	=	NULL 
)
AS
BEGIN
		--TABLAS TEMPORALES PARA INSERTAR EN LA PISTA
		DECLARE @TableTimestampdFACT TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidFACT UNIQUEIDENTIFIER
            )

			DECLARE @TableTimestampdDOC TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguidDOC UNIQUEIDENTIFIER
            )

		--@PARAMETRO ES CADA UNO DE LOS VALORES OBTENIDOS QUE ALMACENAREMOS
		DECLARE @Posicion int
		DECLARE @Parametros CHAR(21),@fact_num CHAR(20)
		DECLARE @valuni_sec DECIMAL(18,5)
		SET @Parametros = LTRIM(RTRIM(@string)) + ','

		--COLOCAMOS UN SEPARADOR AL FINAL DE LOS PARAMETROS
		WHILE PATINDEX('%,%' , @Parametros) <> 0

		--PATINDEX BUSCA UN PATRON EN UNA CADENA Y NOS DEVUELVE SU POSICION
		BEGIN
		  SELECT @Posicion =  PATINDEX('%,%' , @Parametros )
		  SELECT @fact_num  = LEFT(@Parametros , @Posicion - 1)
		  SELECT @Parametros  = STUFF(@Parametros , 1, @Posicion, '')
		  UPDATE saFacturaVenta	  SET anulado = 1 
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdFACT
		  WHERE doc_num = @fact_num

		  UPDATE saDocumentoVenta SET anulado = 1
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestampdDOC 
		  WHERE nro_doc = @fact_num

		-- ANULACION DE FACTURA EN ESPERA
		DECLARE @tabla TABLE(reng_num INT ,co_art CHAR(30),total_art DECIMAL(18,5),co_alma CHAR(6),uni_venta CHAR(10))
		INSERT INTO @tabla (reng_num ,co_art,total_art ,co_alma,uni_venta )
		SELECT reng_num ,co_art,total_art,co_alma,co_uni FROM saFacturaVentaReng WHERE doc_num
```
