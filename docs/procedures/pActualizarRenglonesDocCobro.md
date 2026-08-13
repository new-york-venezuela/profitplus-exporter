# SP: pActualizarRenglonesDocCobro
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pActualizarRenglonesDocCobro
*DESCRIPCIÓN	:	Modifica un registro en la tabla  saCobroDocReng
*CREADO			:   <2011-12-12>
*MODIFICADO		:   <2020-07-01>
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesDocCobro]
    (
      @iReng_Num INT ,
      @sCob_Num CHAR(20) ,
      @iRENG_NUMOri INT ,
      @sCob_NumOri CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @deMont_Cob DECIMAL(18, 2) ,
      @deDpcobro_Porc_Desc DECIMAL(18, 8) ,
      @deDpcobro_Monto DECIMAL(18, 2) ,
      @deMonto_Retencion_iva DECIMAL(18, 2) ,
      @deMonto_Retencion DECIMAL(18, 2) ,
      @gReten_Tercero_Rowguid_Ori UNIQUEIDENTIFIER = NULL ,
      @gRowguid_Reng_Ori UNIQUEIDENTIFIER = NULL ,
      @sTipo_Doc CHAR(4) = NULL ,
      @sNum_Doc CHAR(20) = NULL ,
      @iTipo_Origen INT = NULL ,
      @sGen_Origen CHAR(1) = NULL ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sTrasnfe CHAR(1) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
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
			
                SET @ConcatMensaje = N'El monto establecido es superior al monto restante del documento de compra. Monto actual del documento: '
                    + RTRIM(@sMonedaVenta) + ' ' + CONVERT(NVARCHAR(MAX), @deResMonto * -1)
                RAISERROR(@ConcatMensaje, 16, 1) ;
                RETURN
            END

		/*OBTENGO EL MONTO ACTUAL Y VERIFICO SI EXI
```
