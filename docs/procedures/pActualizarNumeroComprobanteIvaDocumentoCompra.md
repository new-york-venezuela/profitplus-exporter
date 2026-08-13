# SP: pActualizarNumeroComprobanteIvaDocumentoCompra
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pActualizarNumeroComprobanteIvaDocumentoCompra]
DESCRIPCION:	Actualizar/Asignar el número de comprobante de retención de IVA en documentos de compra
CREADO POR:		SOFTECH SISTEMAS
FECHA:			23/09/2010
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarNumeroComprobanteIvaDocumentoCompra]
    (
      @sNro_Doc CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNum_Comprobante VARCHAR(14) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60)
    )
AS 
    BEGIN

        DECLARE @tblDocumento TABLE
            (
              campo VARCHAR(MAX) ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        DECLARE @fecha SMALLDATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @campo VARCHAR(MAX)

        UPDATE
            saDocumentoCompra
        SET num_comprobante = @sNum_Comprobante, fe_us_mo = GETDATE(), co_sucu_mo = @sCo_Sucu_Mo, co_us_mo = @sCo_Us_Mo
        OUTPUT
            '[num_comprobante]=' + Deleted.num_comprobante + '->' + ISNULL(Inserted.num_comprobante, ''),
            Inserted.fe_us_mo, Inserted.rowguid
            INTO 
				@tblDocumento
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc
            AND nro_doc = @sNro_Doc
	
        SELECT
            @fecha = fe_us_mo, @rowGuidOri = rowguid, @campo = campo
        FROM
            @tblDocumento
	
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @fecha, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saDocumentoCompra', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @campo

    END
```
