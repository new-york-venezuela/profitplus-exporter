# SP: RepCompraPesoVolumenxReng
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saFactCompRengPesoVolumen`](../tables/saFactCompRengPesoVolumen.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <2014-08-15>
-- Description:	<Artículos Secundarios con su Stock>
-- =============================================
CREATE PROCEDURE [dbo].[RepCompraPesoVolumenxReng]
	@cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
	@dFecha_d SMALLDATETIME = NULL,
    @dFecha_h SMALLDATETIME = NULL,
	@cCo_prov_d CHAR(16) = NULL,
    @cCo_prov_h CHAR(16) = NULL,
	@cCo_Linea_d CHAR(6) = NULL ,
    @cCo_Linea_h CHAR(6) = NULL ,
    @cCo_SubLinea_d CHAR(6) = NULL ,
    @cCo_SubLinea_h CHAR(6) = NULL ,
    @cCo_Categoria_d CHAR(6) = NULL ,
    @cCo_Categoria_h CHAR(6) = NULL ,
	@cAnulado CHAR(6) = NULL ,
	@cPesoVol CHAR(6) = NULL ,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS
BEGIN
	SET NOCOUNT ON;
		Declare @bEntro BIT
		IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
					
		IF ( LTRIM(@cPesoVol) IS NUlL )
			SET @cPesoVol = 'NO'

		IF 	LTRIM(@cPesoVol) = 'SI'
			BEGIN
				SELECT
					FC.doc_num, FC.fec_emis, FC.fec_venc, FC.co_prov, PRO.prov_des, CP.cond_des, FCR.co_art, ART.art_des, 
					FCR.co_alma, FCR.total_art, FCR.co_uni,
					CASE ISNULL(FCPV.peso_comp,0) WHEN 0 THEN (SELECT
					ISNULL(dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, FCR.total_art),0) * ART.peso)					
					ELSE FCPV.peso_comp END as peso_comp,										 
					CASE ISNULL(FCPV.volumen_comp,0) WHEN 0  THEN (SELECT
					ISNULL(dbo.ArtUnidadBase(FCR.co_art, FCR.co_uni, FCR.total_art),0) * ART.volumen)
					ELSE FCPV.volumen_comp END as volumen_comp, 1 as PesoVol,
					CASE ISNULL(FCPV.peso_comp,0) WHEN 0 THEN 1 ELSE 0 END as Entrada_peso,										 
					CASE ISNULL(FCPV.volumen_comp,0) WHEN 0  THEN 1 ELSE 0 END as Entrada_volumen, FC.anulado

				FROM
					saFacturaCompra FC
					INNER JOIN saFacturaCompraReng FCR ON FCR.doc_num = FC.doc_num
					INNER JOIN saProveedor PRO ON PRO.co_prov = FC.co_prov
					LEFT JOIN saCondicionPago AS CP ON CP.co_cond = FC.co_cond
					INNER JOIN saArticulo ART ON ART.co_art = FCR.co_art
					LEFT JOIN saFactCompRengPesoVolumen FCPV ON FCPV.rowguidDoc = FCR.rowguid            
				WHERE
					(( @cCo_Numero_d IS NULL OR FC.doc_num >= @cCo_Numero_d)
						AND ( @cCo_Numero_h IS NULL OR FC.doc_num <= @cCo_Numero_h))
					AND (( @dFecha_d IS
```
