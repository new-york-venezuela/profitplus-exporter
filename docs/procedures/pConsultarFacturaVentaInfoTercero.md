# SP: pConsultarFacturaVentaInfoTercero
**Tipo**: Consultar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaInfoTercero`](../tables/saFacturaVentaInfoTercero.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pConsultarDocumentoVentaInfoIGTF]
*DESCRIPCIÓN	: 
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pConsultarFacturaVentaInfoTercero]
    (
      @sdoc_num  CHAR(20) ,
	  @sCo_Us_Mo CHAR(6)= NULL ,
	  @sCo_Sucu_Mo CHAR(6) = NULL,
	  @sMaquina VARCHAR(60) = NULL 
      --@sCod_Tercero CHAR(16)
    )
AS 
    BEGIN
		
     DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT @rowGuidOri = rowguid
          FROM saFacturaVenta
         where doc_num = @sdoc_num

        select  co_tercero
		  from saFacturaVentaInfoTercero
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
