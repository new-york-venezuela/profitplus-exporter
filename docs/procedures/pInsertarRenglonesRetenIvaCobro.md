# SP: pInsertarRenglonesRetenIvaCobro
**Tipo**: Insertar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saCobroRetenIvaReng`](../tables/saCobroRetenIvaReng.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:	pInsertarRenglonesRetenIvaCobro
*DESCRIPCIÓN	:	Inserta un registro de retencion de IVA relacionado a un documento de Cobro
*AUTOR			:	SOFTECH SISTEMAS
***********************************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesRetenIvaCobro]
    (
      @gRowguid_Reng_Cob UNIQUEIDENTIFIER ,
      @iRENG_NUM INT ,
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
      @sNumero_Expediente CHAR(15) ,
      @bReten_Tercero BIT ,
      @sREVISADO CHAR(1) ,
      @sTRASNFE CHAR(1) ,
      @sco_sucu_in CHAR(6) = NULL ,
      @sco_us_in CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL		
    )
AS 
    BEGIN
		
        DECLARE @Tabletimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
		
        INSERT  INTO saCobroRetenIvaReng
                ( reng_num, rowguid_reng_cob, rif_contribuyente, periodo_impositivo, fecha_documento, tipo_operacion,
                  tipo_documento, rif_comprador, numero_documento, numero_control_documento, monto_documento,
                  base_imponible, monto_ret_imp, numero_documento_afectado, num_comprobante, monto_excento, alicuota,
                  numero_expediente, reten_tercero, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
                  revisado, trasnfe )
        OUTPUT  Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iRENG_NUM, @gRowguid_Reng_Cob, @sRif_Contribuyente, @dePeriodo_Impositivo, @sdFecha_Documento,
                  @sTipo_Operacion, @sTipo_Documento, @sRif_Comprador, @sNumero_Documento, @sNumero_Control_Documento,
                  @deMonto_Documento, @deBase_Imponible, @deMonto_Re
```
