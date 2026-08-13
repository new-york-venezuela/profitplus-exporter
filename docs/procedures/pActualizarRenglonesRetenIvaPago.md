# SP: pActualizarRenglonesRetenIvaPago
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRetenIvaReng`](../tables/saPagoRetenIvaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************
*NOMBRE			:	pActualizarRenglonesRetenIvaPago
*DESCRIPCIÓN	:	Actualiza un registro de retencion de IVA relacionado a un documento de pago
*AUTOR			:	SOFTECH SISTEMAS
**************************************************************************************************/

CREATE PROCEDURE [pActualizarRenglonesRetenIvaPago]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER ,
      @gRowguid_Reng_CobOri UNIQUEIDENTIFIER ,
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @sRif_Contribuyente CHAR(10) ,
      @dePeriodo_Impositivo DECIMAL(6, 0) ,
      @sdFecha_Documento SMALLDATETIME ,
      @sTipo_Operacion CHAR(1) ,
      @sTipo_Documento CHAR(4) ,
      @sRif_Comprador CHAR(10) ,
      @sNumero_Documento CHAR(20) ,
      @sNumero_Control_Documento CHAR(20) ,
      @deMonto_Documento DECIMAL(15, 2) ,
      @deBase_Imponible DECIMAL(15, 2) ,
      @deMonto_Ret_Imp DECIMAL(15, 2) ,
      @sNumero_Documento_Afectado CHAR(20) ,
      @sNum_Comprobante CHAR(14) ,
      @deMonto_Excento DECIMAL(15, 2) ,
      @deAlicuota DECIMAL(5, 2) ,
      @SNumero_Expediente CHAR(15) ,
      @bReten_Tercero BIT ,
      @sREVISADO CHAR(1) ,
      @sTRASNFE CHAR(1) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @growguid UNIQUEIDENTIFIER ,
      @sCampos VARCHAR(MAX)
    )
AS 
    BEGIN
		
        DECLARE @Tabletimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		select @sNum_Comprobante = DC.num_comprobante from saDocumentoCompra AS DC INNER JOIN saPagoDocReng AS PDR ON DC.nro_doc = PDR.nro_doc
                                                  AND DC.co_tipo_doc = PDR.co_tipo_doc
												  where PDR.rowguid = @gRowguid_Reng_Cob
		
        UPDATE
            saPagoRetenIvaReng
        SET reng_num = @iRENG_NUM, rowguid_reng_cob = @gRowguid_Reng_Cob, Rif_Contribuyente = @sRif_Contribuyente,
            Periodo_Impositivo = @dePeriodo_Impositivo, Fecha_Documento = @sdFecha_Documento,
            Tipo_Operacion = @sTipo_Operacion, Tipo_Documento = @sTipo_Documento, Rif_Comprador = @sRif_Comprador,
            Numero_Documento = @sNumero_Documento, Numero_Control_Documento = @sNumero_Control_Documento,
            Monto_Documento = @deMonto_Documento, Base_Imponible = @d
```
