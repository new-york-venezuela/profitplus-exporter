# SP: pInsertarTipoDocumento
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarTipoDocumento
*DESCRIPCIÓN	: Inserta una Configuración en la tabla saTipoDocumento
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarTipoDocumento]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sDescrip VARCHAR(60) ,
      @sTipo_Mov CHAR(2) ,
      @bUsar_Ventas BIT ,
      @bUsar_Compras BIT ,
      @bRegistro_Sistema BIT ,
      @bNum_Fact_Fis_Venta BIT ,
      @bNum_Cont_Venta BIT ,
      @bSerial_Imp_Fis_Venta BIT ,
      @bReng_Venta BIT ,
      @bNum_Iva_Venta BIT ,
      @bDoc_Prov_Compra BIT ,
      @bNum_Control_Compra BIT ,
      @bReng_Compra BIT ,
      @bNum_Iva_Compra BIT ,
      @bManual_Venta BIT ,
      @bManual_Compra BIT ,
      @bDoc_Asoc_Venta BIT ,
      @bDoc_Asoc_Compra BIT ,
      @bAct_Prog_Pago BIT ,
      @bReac_doc_Compra BIT ,
      @bReac_doc_Venta BIT ,
      @bAnul_doc_venta BIT ,
      @bAnul_doc_compra BIT ,
      @bAplica_dxpp_venta BIT ,
      @bAplica_dxpp_compra BIT ,
      @bAplica_riva_venta BIT ,
      @bAplica_riva_compra BIT ,
      @sTipo_imp CHAR(1) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
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

        INSERT  INTO saTipoDocumento
                ( co_tipo_doc, descrip, tipo_mov, usar_ventas, usar_compras, registro_sistema, num_fact_fis_venta,
                  num_cont_venta, serial_imp_fis_venta, reng_venta, num_iva_venta, doc_prov_compra, num_control_compra,
                  reng_compra, num_iva_compra, manual_venta, manual_compra, doc_Asoc_Compra, doc_Asoc_Venta,
                  act_prog_pago, aplica_dxpp_venta, aplica_dxpp_compra, aplica_riva_venta, aplica_riva_compra, tipo_imp,
                  Reac_doc_Compra, Reac_doc_Venta, Anul_doc_venta, An
```
