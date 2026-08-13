# SP: pInsertarRenglonesDocPago
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarRenglonesPagoDoc
*DESCRIPCIÓN	:	Inserta un pago
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO		:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesDocPago]
    (
      @iReng_Num INT ,
      @sCob_Num CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @sNro_Fact VARCHAR(20) = NULL ,
      @deMont_Cob DECIMAL(18, 2) ,
      @deDppago_Porc_Desc DECIMAL(18, 2) ,
      @deDppago_Monto DECIMAL(18, 2) ,
      @deMonto_Retencion_iva DECIMAL(18, 2) ,
      @deMonto_Retencion DECIMAL(18, 2) ,
      @sTipo_Doc CHAR(4) = NULL ,
      @sNum_Doc CHAR(20) = NULL ,
      @gRowguid_Reng_Ori UNIQUEIDENTIFIER = NULL ,
      @gReten_Tercero_Rowguid_Ori UNIQUEIDENTIFIER = NULL ,
      @gRowguid UNIQUEIDENTIFIER ,
      @iTipo_Origen INT = NULL ,
      @sGen_Origen CHAR(1) = NULL ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sTrasnfe CHAR(1) = NULL ,
      @sRevisado CHAR(1) = NULL ,
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
		
        DECLARE @deMontoDocumentoCompra DECIMAL(18, 2)
        DECLARE @deMontoDocumentoPago DECIMAL(18, 2)
        DECLARE @deResMonto DECIMAL(18, 2)
        DECLARE @sMonedaCompra CHAR(6)
		
        SELECT
            @deMontoDocumentoCompra = ISNULL(total_neto, 0), @sMonedaCompra = co_mone
        FROM
            saDocumentoCompra
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc
            AND nro_doc = @sNro_Doc
		
        SET @deResMonto = @deMontoDocumentoCompra - @deMont_Cob
		
        IF ( @deResMonto < 0 ) 
            BEGIN
                DECLARE @ConcatMensaje NVARCHAR(MAX)
			
                SET @ConcatMensaje = N'El monto establecido es superior al monto restante del documento de compra. Monto actual del documento: '
                    + RTRIM(@sMonedaCompra) + ' ' + CONVERT(NVARCHAR(MAX), @deResMonto * -1)
                --PRINT @deMontoDocumentoCompra
                RAISERROR(@ConcatMensaje, 16, 1) ;
                RETURN
            END

        INSERT  INTO saPagoDocReng
                ( reng_num, cob_num, co_tipo_doc, nro_doc, nro_fact, mont_cob, dpp
```
