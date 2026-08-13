# SP: pInsertarInfoDocumentoCompraNCF
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	  [pInsertarInfoDocumentoCompraNCF]
*DESCRIPCIÓN	:	  Inserta un registro en la tabla  saNCFInfoDocCompra
*AUTOR			:	  SOFTECH SISTEMAS
*FECHA CREACIÖN	:	  19/06/2015
*FECHA ACTUALIZACIÓN: 21/11/2019
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarInfoDocumentoCompraNCF]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
	  @sco_serie CHAR(20) = NULL,
	  @sSeriencf CHAR(20) = NULL,
	  @sTipo_Doc_Ori CHAR(6) = NULL ,
      @sNro_Doc_Ori CHAR(20) = NULL ,
	  @sCod_Gasto CHAR(4) = NULL ,
      @bAnulado BIT ,
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
			
		-- Valida la duplicidad de NCF solo si el tipo de comprobante no es manual
  		IF EXISTS( SELECT * FROM saNCFInfoDocCompra WHERE ncf = @sSeriencf AND co_serie IS NOT NULL)
		BEGIN
			SET @MensajeError = 'Ya existe un documento con el mismo Número de Comprobante Fiscal'
			RAISERROR(@MensajeError,16,1)
			RETURN
		END
		
		--Valida que no exista el NCF para el mismo Proveedor
		IF EXISTS( SELECT * FROM saDocumentoCompra WHERE co_tipo_doc = @sCo_Tipo_Doc AND nro_doc = @sNro_Doc AND co_prov IN (
			SELECT B.co_prov FROM saNCFInfoDocCompra A INNER JOIN saDocumentoCompra B
			ON B.co_tipo_doc = A.tipo_doc AND B.nro_doc = A.nro_doc WHERE A.ncf = @sSeriencf ) )
		BEGIN
			SET @MensajeError = 'Ya existe un documento con el mismo Número de Comprobante Fiscal para este Proveedor'
			RAISERROR(@MensajeError,16,1)
			RETURN
		END
	
		INSERT  INTO saNCFInfoDocCompra
				(
					tipo_doc, nro_doc, co_serie, ncf, tipo_doc_Ori, nro_doc_Ori, co_gasto, anulado, 
					campo1, campo2, campo3,
```
