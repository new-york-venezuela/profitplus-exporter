# SP: RepCompraConDatosImportacion
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2016-08-01>
-- Description:	<Compras con sus Datos de Importación>
-- =============================================
CREATE PROCEDURE [dbo].[RepCompraConDatosImportacion]
	-- Add the parameters for the stored procedure here
    @sDoc_Num_d CHAR(20) = NULL,
	@sDoc_Num_h CHAR(20) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0,
	@sNombreDBMaestra VARCHAR(max)
AS 
    BEGIN
        SET NOCOUNT ON ;

		DECLARE @Query NVARCHAR(max)
        SET @Query = 'SELECT co_fijo, co_grupo, desc_fijo, producto from '+ @sNombreDBMaestra +'.[dbo].[MpFijo]'

	DECLARE @TablaFijos TABLE
				(
				  co_fijo char(4) ,
						co_grupo char(3),
				  desc_fijo varchar(60),
						producto char(6)
				)

	INSERT INTO
	@TablaFijos
	EXEC sp_executesql @Query

	DELETE FROM @TablaFijos WHERE co_grupo != 'ISV' 

	
        SELECT

		--Factura al Tesoro Nacional
            FTNac.doc_num, FTNac.fec_emis, FTNac.co_prov, PR.prov_des,
			
			FTNReng.reng_num, FTNReng.co_art, AR.art_des, (SELECT desc_fijo FROM @TablaFijos WHERE co_fijo = DI.tasa) AS Tasa_Apli, DI.tasa_valor,
			(SELECT MCI.base_imp FROM ObtenerMontosColumnaImportacion(DI.fact_num) MCI WHERE MCI.tipo_imp = DI.tasa) AS valorMercancia,
			DI.total_imp,

		--Factura de Importacion
			FCI.doc_num AS FCI_doc_num, FCI.fec_emis AS FCI_fec_emis, FCI.co_prov AS FCI_co_prov, FCI_PR.prov_des AS FCI_prov_des,

			FCIReng.reng_num AS FCI_reng_num, FCIReng.co_art AS FCI_co_art, FCI_AR.art_des AS FCI_art_des, (SELECT desc_fijo FROM @TablaFijos WHERE co_fijo = ISNULL(AI.tipo_imp, 1)) AS Tasa_Nac, FCIReng.reng_neto, FCIReng.monto_imp


        
		FROM
            saFacturaCompra FTNac
			INNER JOIN saProveedor PR ON PR.co_prov = FTNac.co_prov
			INNER JOIN saFacturaCompraReng FTNReng ON FTNReng.doc_num = FTNac.doc_num
			INNER JOIN saArticulo AR ON AR.co_art = FTNReng.co_art
			INNER JOIN saDatosDeImportacion DI ON DI.rowguid_factura_renglon = FTNReng.rowguid

			INNER JOIN saArtImportacion FT_AI ON FT_AI.co_art = AR.co_art AND FT_AI.calculo = 3

			INNER JOIN saFacturaCompra FCI ON FCI.doc_num = DI.fact_num
			INNER JOIN saProveedor FCI_PR ON FCI_PR.co_prov = FCI.co_prov
			INNER JOIN saFacturaCompraReng FCIReng ON FCIReng.doc_num = FCI.doc_num
			INNER JOIN saArticulo FCI_AR ON FCI_AR.co_art = FCIReng.co_art

			LEFT JOIN saArtImportaci
```
