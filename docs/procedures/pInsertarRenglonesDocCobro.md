# SP: pInsertarRenglonesDocCobro
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pInsertarRenglonesCobroDoc
*DESCRIPCIÓN	:	Inserta un cobro
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO		:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesDocCobro]
    (
      @iReng_Num INT ,
      @sCob_Num CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @deMont_Cob DECIMAL(18, 2) ,
      @deDpCobro_Porc_Desc DECIMAL(18, 2) ,
      @deDpCobro_Monto DECIMAL(18, 2) ,
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
		
        DECLARE @deMontoDocumentoVenta DECIMAL(18, 2)
        DECLARE @deMontoDocumentoCobro DECIMAL(18, 2)
        DECLARE @deResMonto DECIMAL(18, 2)
        DECLARE @sMonedaVenta CHAR(6)
		
        SELECT
            @deMontoDocumentoVenta = ISNULL(total_neto, 0), @sMonedaVenta = co_mone
        FROM
            saDocumentoVenta
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc
            AND nro_doc = @sNro_Doc
		
        SET @deResMonto = @deMontoDocumentoVenta - @deMont_Cob
		
        IF ( @deResMonto < 0 ) 
            BEGIN
                DECLARE @ConcatMensaje NVARCHAR(MAX)
			
                SET @ConcatMensaje = N'El monto establecido es superior al monto restante del documento de Venta. Monto actual del documento: '
                    + RTRIM(@sMonedaVenta) + ' ' + CONVERT(NVARCHAR(MAX), @deResMonto * -1)
                --PRINT @deMontoDocumentoVenta
                RAISERROR(@ConcatMensaje, 16, 1) ;
                RETURN
            END

        INSERT  INTO saCobroDocReng
                ( reng_num, cob_num, co_tipo_doc, nro_doc, mont_cob, dpCobro_porc_desc, dpCobro_monto,
                  mon
```
