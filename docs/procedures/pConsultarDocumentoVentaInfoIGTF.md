# SP: pConsultarDocumentoVentaInfoIGTF
**Tipo**: Consultar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaInfoIGTF`](../tables/saDocumentoVentaInfoIGTF.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pConsultarDocumentoVentaInfoIGTF]
*DESCRIPCIÓN	: 
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pConsultarDocumentoVentaInfoIGTF]
    (
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) --,
      --@dBase_imponible DECIMAL(18, 2) ,
	  --@dPorc_aplic DECIMAL(21, 8) 
    )
AS 
    BEGIN
		
     DECLARE @rowGuidOri UNIQUEIDENTIFIER
	 DECLARE @otros1 decimal(18,2)

        SELECT @rowGuidOri = rowguid, @otros1 =otros1
          FROM saDocumentoVenta
         where co_tipo_doc = @sCo_Tipo_Doc
           and nro_doc = @sNro_Doc

        select  base_imponible ,porc_aplic , @otros1 as igtf
		  from saDocumentoVentaInfoIGTF
         where rowguid = @rowGuidOri

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
