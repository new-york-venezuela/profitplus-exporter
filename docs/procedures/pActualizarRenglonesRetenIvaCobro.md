# SP: pActualizarRenglonesRetenIvaCobro
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saCobroRetenIvaReng`](../tables/saCobroRetenIvaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************
*NOMBRE			:	pActualizarRenglonesRetenIvaPago
*DESCRIPCIÓN	:	Actualiza un registro de retencion de IVA relacionado a un documento de pago
*AUTOR			:	SOFTECH SISTEMAS
**************************************************************************************************/

CREATE PROCEDURE [pActualizarRenglonesRetenIvaCobro]
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
		
		
        UPDATE
            saCobroRetenIvaReng
        SET reng_num = @iRENG_NUM, rowguid_reng_cob = @gRowguid_Reng_Cob, Rif_Contribuyente = @sRif_Contribuyente,
            Periodo_Impositivo = @dePeriodo_Impositivo, Fecha_Documento = @sdFecha_Documento,
            Tipo_Operacion = @sTipo_Operacion, Tipo_Documento = @sTipo_Documento, Rif_Comprador = @sRif_Comprador,
            Numero_Documento = @sNumero_Documento, Numero_Control_Documento = @sNumero_Control_Documento,
            Monto_Documento = @deMonto_Documento, Base_Imponible = @deBase_Imponible, Monto_Ret_Imp = @deMonto_Ret_Imp,
            Numero_Documento_Afectado = @sNumero_Documento_Afectado, Num_Comprobante = @sNum_Comprobante,
            Monto_Excento = @deMonto_Excento, Alicuota = @deAlicuota, Numero_Expediente = @sNumero_Expediente,
```
