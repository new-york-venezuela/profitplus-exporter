# SP: pInsertarInfoDocumentoVentaNCF
**Tipo**: Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			    : [pInsertarInfoDocumentoVentaNCF]
*DESCRIPCIÓN	    : Inserta un registro en la tabla  saNCFInfoDocVenta
*AUTOR			    : SOFTECH SISTEMAS
*FECHA CREACIÖN	    : 19/06/2015
*FECHA ACTUALIZACIÖN: 20/06/2019
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarInfoDocumentoVentaNCF]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
	  @sco_serie CHAR(20) = NULL ,
	  @sSeriencf CHAR(20) = NULL,
	  @sTipo_Doc_Ori CHAR(6) = NULL ,
      @sNro_Doc_Ori CHAR(20) = NULL ,
      @bAnulado BIT ,
	  @sCo_Anulacion CHAR(4) = NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
	  @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
	  @sCo_Us_Mo CHAR(6) ,
	  @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN

		DECLARE @MensajeError VARCHAR(128)

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
			
			
		IF EXISTS( SELECT * FROM saNCFInfoDocVenta WHERE ncf = @sSeriencf)
		BEGIN
			SET @MensajeError = 'Ya existe un documento con el mismo Número de Comprobante Fiscal'
			RAISERROR(@MensajeError,16,1)
			RETURN
		END		
  
		INSERT  INTO saNCFInfoDocVenta
				(
					tipo_doc, nro_doc, co_serie, ncf, tipo_doc_Ori, nro_doc_Ori, anulado, co_anulacion,
					campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_sucu_in, fe_us_in,
					co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe
					)

		OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				INTO @TableTimestamp

		VALUES
				( @sCo_Tipo_Doc, @sNro_Doc, @sco_serie, @sSeriencf, @sTipo_Doc_Ori, @sNro_Doc_Ori, @bAnulado, @sCo_Anulacion, 
					@sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8,
					@sco_us_in, @sco_sucu_in, GETDATE(), @sco_us_in, @sco_sucu_in, GETDATE(), @sRevisado, @sTrasnfe 
				)

		DECLARE @dtFe_In DATETIME
		DEC
```
