# SP: pInsertarDocumentoVentaInfoIGTF
**Tipo**: Insertar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/01/2016>
-- Description:	<pInsertarDocumentoVentaInfoIGTF>
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarDocumentoVentaInfoIGTF]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @dBase_imponible DECIMAL(18, 2) ,
	  @dPorc_aplic DECIMAL(21, 8) 
    )
AS 
    BEGIN
		
     DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT @rowGuidOri = rowguid
          FROM saDocumentoVenta
         where co_tipo_doc = @sCo_Tipo_Doc
           and nro_doc = @sNro_Doc

        INSERT INTO saDocumentoVentaInfoIGTF
           (rowguid ,base_imponible ,porc_aplic)
        VALUES
           (@rowGuidOri ,@dBase_imponible,@dPorc_aplic)

        --SELECT
        --    @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        --FROM
         --   @TableTimestamp

		-- Insertar Pista
       -- EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
       --     @sTablaOri = 'saDocumentoVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
       --     @sCampos = @sNro_Doc
		
       -- SELECT
       --     *
       -- FROM
         --   @TableTimestamp
		
    END
```
