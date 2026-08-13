# SP: pSeleccionarComprobantesAnulados608_DOM
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saNCFInfoDocCompra`](../tables/saNCFInfoDocCompra.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24/02/2017>
-- Last Modify: <21/06/2019>
-- Description:	<DGII Formato de Envío de Comprobantes Anulados (608)>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarComprobantesAnulados608_DOM] 

    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
	@co_sucuD AS CHAR(6) = NULL ,
	@co_sucuH AS CHAR(6) = NULL
AS 
    BEGIN
        SET NOCOUNT ON ;
		
		IF @sFecha_h IS NOT NULL
            SET @sFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sFecha_h))
		
		----------------------------------------------------------------------------------------------------------------------
		DECLARE @todasSucu BIT

		SET @co_sucuD = COALESCE(@co_sucuD, '')
		SET @co_sucuH = COALESCE(@co_sucuH, '')

		SET @todasSucu = 
		(CASE WHEN @co_sucuD <> '' THEN
			CASE WHEN @co_sucuH <> '' THEN 0
				ELSE 1
			END
			ELSE 1
		END)
		----------------------------------------------------------------------------------------------------------------------
		
		SELECT
			CASE WHEN A.NCF <> ' ' 
				 THEN CASE WHEN LEFT(A.NCF, 8) <> '00000000' 
						 THEN LEFT(A.NCF, 1) + RIGHT(RTRIM(A.NCF), 10)
						 ELSE SUBSTRING(A.NCF, 9, 1) + RIGHT(RTRIM(A.NCF), 10)
					END
				 ELSE '00000000000'
			END NCF
			, A.FECHA_ANULACION
			, CASE WHEN LEFT(A.TIPO_ANULACION, 1) = '0' 
					 THEN REPLACE(A.TIPO_ANULACION, '0', ' ') 
					 ELSE A.TIPO_ANULACION 
			END AS TIPO_ANULA
			, A.TIPO_DOC
			, A.NRO_DOC
		FROM
			(
				SELECT 1 metaorder,
					dv.co_tipo_doc AS TIPO_DOC, dv.nro_doc, dv.co_cli, COALESCE(rdv.ncf, ' ') AS NCF, dv.fec_emis,
					dv.fe_us_mo AS FECHA_ANULACION, 
					COALESCE(rdv.co_anulacion, '00') AS TIPO_ANULACION
				FROM
					saDocumentoVenta dv
					INNER JOIN saNCFInfoDocVenta rdv ON rdv.tipo_doc = dv.co_tipo_doc AND rdv.nro_doc = dv.nro_doc
				WHERE   
					dv.anulado = 1
					AND ((@todasSucu = 1) OR (dv.co_sucu_in BETWEEN @co_sucuD AND @co_sucuH))

				UNION ALL
			
				SELECT 2 metaorder,
					DC.co_tipo_doc AS TIPO_DOC, DC.nro_doc, DC.co_prov, COALESCE(NCF.ncf, ' ') AS NCF, DC.fec_emis,
					DC.fe_us_mo AS FECHA_ANULACION,
					COALESCE(NCF.co_anulacion, '00') AS TIPO_ANULACION
				FROM
					saDocumentoCompra DC
					INNER JOIN saNCFInfoDocCompra NCF ON NCF.tipo_doc = DC.co_tipo_doc AND NCF.nro_doc = DC.nro_doc
					INNER JOIN saProveedor prv ON DC.co_prov = prv
```
