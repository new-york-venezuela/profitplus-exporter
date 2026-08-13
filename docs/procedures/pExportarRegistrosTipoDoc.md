# SP: pExportarRegistrosTipoDoc
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosTipoDoc
*DESCRIPCIÓN	:	Inserta un concepto de tipo de documento
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarRegistrosTipoDoc]
    (
      @sCo_Tipo_Doc			CHAR(6),
      @sDescrip				VARCHAR(60),
      @sTipo_Mov			CHAR(2),
      @bUsar_Ventas			BIT,
      @bUsar_Compras		BIT,
      @bRegistro_Sistema	BIT,
      @bNum_Fact_Fis_Venta	BIT,
      @bNum_Cont_Venta		BIT,
      @bSerial_Imp_Fis_Venta BIT,
      @bReng_Venta			BIT,
      @bNum_Iva_Venta		BIT,
      @bDoc_Prov_Compra		BIT,
      @bNum_Control_Compra	BIT,
      @bReng_Compra			BIT,
      @bNum_Iva_Compra		BIT,
      @bManual_Venta		BIT,
      @bManual_Compra		BIT,
      @bDoc_Asoc_Venta		BIT,
      @bDoc_Asoc_Compra		BIT,
      @bAct_Prog_Pago		BIT,
      @bReac_doc_Compra		BIT,
      @bReac_doc_Venta		BIT,
      @bAnul_doc_venta		BIT,
      @bAnul_doc_compra		BIT,
      @bAplica_dxpp_venta	BIT,
      @bAplica_dxpp_compra	BIT,
      @bAplica_riva_venta	BIT,
      @bAplica_riva_compra	BIT,
      @sTipo_imp			CHAR(1),
      
      @sCampo1				VARCHAR(60) = NULL,
      @sCampo2				VARCHAR(60) = NULL,
      @sCampo3				VARCHAR(60) = NULL,
      @sCampo4				VARCHAR(60) = NULL,
      @sCampo5				VARCHAR(60) = NULL,
      @sCampo6				VARCHAR(60) = NULL,
      @sCampo7				VARCHAR(60) = NULL,
      @sCampo8				VARCHAR(60) = NULL,
      @sCo_us_in			CHAR(6),
      @sCo_sucu_in			CHAR(6)		= NULL,
      @sRevisado			CHAR(1),
      @sTrasnfe				CHAR(1),
      @sEmpresa				VARCHAR(60),
      @sMaquina				VARCHAR(60)
    )
AS 
    BEGIN
		DECLARE @sSql		NVARCHAR(4000) 

		SET @sSql = N'EXEC [' + @sempresa + '].[dbo].[pInsertarTipoDocumento]	
																		@sCo_Tipo_Doc,
																		@sDescrip,
																		@sTipo_Mov,
																		@bUsar_Ventas,
																		@bUsar_Compras,
																		@bRegistro_Sistema,
																		@bNum_Fact_Fis_Venta,
																		@bNum_Cont_Venta,
																		@bSerial_Imp_Fis_Venta,
																		@bReng_Venta,
																		@bNum_Iva_Venta,
																		@bDoc_Prov_Compra,
																		@bNum_Control_Compra,
																		@bReng_Compra,
																		@bNum_Iva_Compra,
																		@bManual_Venta,
																		@bManual_Compra,
```
