# SP: pActualizarTipoDocumento
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarTipoDocumento
*DESCRIPCIÓN	: Actualiza la tabla pActualizarTipoDocumento
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarTipoDocumento]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sCo_Tipo_DocOri CHAR(6) ,
      @sDescrip VARCHAR(60) ,
      @sTipo_Mov CHAR(2) ,
      @bUsar_Ventas BIT ,
      @bUsar_Compras BIT ,
      @bRegistro_Sistema BIT ,
      @bNum_Fact_Fis_Venta BIT ,
      @bNum_Cont_Venta BIT ,
      @bSerial_Imp_Fis_Venta BIT ,
      @bNum_Iva_Venta BIT ,
      @bReac_doc_Compra BIT ,
      @bReac_doc_Venta BIT ,
      @bAnul_doc_venta BIT ,
      @bAnul_doc_compra BIT ,
      @bDoc_Prov_Compra BIT ,
      @bNum_Control_Compra BIT ,
      @bReng_Compra BIT ,
      @bReng_Venta BIT ,
      @bNum_Iva_Compra BIT ,
      @bManual_Venta BIT ,
      @bManual_Compra BIT ,
      @bDoc_Asoc_Compra BIT ,
      @bDoc_Asoc_Venta BIT ,
      @bAct_Prog_Pago BIT ,
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 

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

        UPDATE
            saTipoDocumento
        SET co_tipo_doc = @sCo_Tipo_Doc, descrip = @sDescrip, tipo_mov = @sTipo_Mov, usar_ventas = @bUsar_Ventas,
            usar_compras = @bUsar_Compras, registro_sistema = @bRegistro_Sistema,
            num_fact_fis_venta = @bNum_Fact_Fis_Venta, num_cont_venta = @bNum_Cont_Venta,
            serial_imp_fis_venta = @bSerial_Imp_Fis_Venta, reng_venta = @bReng_Venta, n
```
