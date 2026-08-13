# SP: RepLibroCompraNCFDOM
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
---- =============================================
---- Author:		SOFTECH SISTEMAS
---- Create date: 2019-04-15
---- Last Update: 2020-02-19
---- Description:	Obtiene los documentos involucrados en el libro de compras
--   según un rango de parámetros definidos por el usuario 
---- =============================================
CREATE PROCEDURE [dbo].[RepLibroCompraNCFDOM] 


-- Add the parameters for the stored procedure here
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,--agregada a solicitud 28/05/2019
    @sCo_proveedor_d CHARACTER (16) = NULL,
    @sCo_proveedor_h CHARACTER (16)= NULL,
    @sCo_Tipogasto CHARACTER (2)= NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0,
    
    --No Utilizadas para NCF************************
    @bIncluirOrden VARCHAR(2) = NULL,
    @bIncluirOrdenExt VARCHAR(2) = NULL,
	@bImprimirColumnImport VARCHAR(2) = NULL,
	@bImprimirColumnArt33 VARCHAR(2) = NULL,
	@bImprimirColumnArt34 VARCHAR(2) = NULL
 
  
AS 
   BEGIN
        SET NOCOUNT ON ;
	
       IF @sCo_fecha_h IS NOT NULL
            SET @sCo_fecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sCo_fecha_h))
			
		IF  @bIncluirOrden IS NULL
			SET  @bIncluirOrden = 'NO'

		IF @bIncluirOrdenExt IS NULL
			SET @bIncluirOrdenExt = 'NO'
			
		IF @bImprimirColumnImport IS NULL
			SET @bImprimirColumnImport = 'NO'


/*---------------------------------------------------------------------------------------------------------
Esta parte es para obtener los documentos y darle formato a cada registro del libro de compras
---------------------------------------------------------------------------------------------------------*/

        DECLARE @temp TABLE
            (
              [nro_doc] [char](20) ,
              [co_tipo_doc] [char](6) ,
              [fecha_emis] [smalldatetime],
              [fe_us_in] [smalldatetime] ,
              [total_neto] [decimal](18, 2) ,
              [co_prov] [char](16) ,
              [prov_des] [char](100) ,
              [r] [char](18) ,
              [tipo_prov] [char](4) ,
              [contrib] [bit] ,
              [nac] [char](1) ,
              [co_sucu_in] [char](6) ,
              [nro_orig] [char](20) ,
              [doc_orig] [char](6) ,
              [aut] [bit] ,
              [co_mone] [char](6) ,
              [nro_fact] [varchar](20) ,
```
