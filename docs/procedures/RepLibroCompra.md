# SP: RepLibroCompra
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03/23/2011>
-- Last Update: <2021-02-19>
-- Description:	<Reporte de Libro de Compras>
-- =============================================
CREATE PROCEDURE [dbo].[RepLibroCompra] 
-- Add the parameters for the stored procedure here
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @bIncluirOrden varchar(2) = NULL,
	@bImprimirColumnImport VARCHAR(2) = NULL,
	@bImprimirColumnArt33 VARCHAR(2) = NULL,
	@bImprimirColumnArt34 VARCHAR(2) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sCo_fecha_h))
			
		IF @bImprimirColumnImport IS NULL
			SET @bImprimirColumnImport = 'NO'

		IF @bImprimirColumnArt33 IS NULL
			SET @bImprimirColumnArt33 = 'SI'

		IF @bImprimirColumnArt34 IS NULL
			SET @bImprimirColumnArt34 = 'SI'

/*---------------------------------------------------------------------------------------------------------
Esta parte es para obtener los documentos y darle formato a cada registro del libro de compras
---------------------------------------------------------------------------------------------------------*/

        DECLARE @temp TABLE
            (
              [nro_doc] [char](20) ,
              [co_tipo_doc] [char](6) ,
              [fecha_emis] [smalldatetime] ,
              [fe_us_in] [datetime] ,
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
              [n_control] [char](20) ,
              [anulado] [bit] ,
              [fec_reg] [smalldatetime] ,
              [ven_ter] [bit] ,
              [base_imp] [decimal](18, 2) ,
              [tipo_imp] [char](1) ,
              [tasa] [decimal](18, 5) ,
              [monto_imp] [decimal](18, 2) ,
              [doc_afec] [char](20) ,
              [comp
```
