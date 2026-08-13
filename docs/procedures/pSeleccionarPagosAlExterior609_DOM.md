# SP: pSeleccionarPagosAlExterior609_DOM
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saProveedorExt`](../tables/saProveedorExt.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <24/02/2017>
-- Last Modify: <17/05/2019>
-- Description:	<DGII Formato de Envío de Pagos al Exterior (609) 
-- Realiza la consulta de los documentos tipo Facturas de Compras a proveedores extranjeros con su Retención
-- Se asume que solo habra una sola retención por documentos, de no ser asi ver solución en Archivo TXT 609
-- Actualizacion a la Norma: 07-2018 DGII>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarPagosAlExterior609_DOM] 

    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @cCo_Sucursal_d AS CHAR(6) = NULL,
	@cCo_Sucursal_h AS CHAR(6) = NULL
AS
	BEGIN
	
		IF @sFecha_h IS NOT NULL
            SET @sFecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sFecha_h))
			
		----------------------------------------------------------------------------------------------------------------------
		DECLARE @todasSucu BIT

		SET @cCo_Sucursal_d = COALESCE(@cCo_Sucursal_d, '')
		SET @cCo_Sucursal_h = COALESCE(@cCo_Sucursal_h, '')

		SET @todasSucu = 
		(CASE WHEN @cCo_Sucursal_d <> '' THEN
			CASE WHEN @cCo_Sucursal_h <> '' THEN 0
				ELSE 1
			END
			ELSE 1
		END)
		----------------------------------------------------------------------------------------------------------------------
		
		SELECT
				  COALESCE(A.RAZON_SOCIAL,A.PROV_DES) AS RAZON_SOCIAL
				, A.TIPO_ID_TRIBUTARIA
				, COALESCE(A.ID_TRIBUTARIA,A.PROV_DES) AS ID_TRIBUTARIA
				, A.PAIS_DESTINO
				, LEFT(A.DET_TIPO_GASTO,1) AS TIPO_GASTO
				, A.DET_TIPO_GASTO
				, '0' AS PARTE_RELACIONADA
				, A.NRO_FACT AS NUMERO_DOCUMENTO
				, A.FECHA_DOCUMENTO
				, A.MONTO_FACTURADO
				, CASE
							WHEN A.FECHA_ISR BETWEEN @sFecha_d AND @sFecha_h
							THEN A.FECHA_ISR
							ELSE NULL
					END AS FECHA_ISR
				, CASE
							WHEN A.FECHA_ISR BETWEEN @sFecha_d AND @sFecha_h
							THEN A.MONTO_BASE_ISR
							ELSE 000000000000.00
					END AS MONTO_BASE_ISR
				, CASE
							WHEN A.FECHA_ISR BETWEEN @sFecha_d AND @sFecha_h
							THEN A.MONTO_ISR
							ELSE 000000000000.00
					END AS MONTO_ISR
				--
				, A.NRO_DOC
				, A.CO_TIPO_DOC
				, A.CO_SUCU_IN
		FROM
(
		SELECT
				   dcp.nro_doc
				 , dcp.co_tipo_doc
				 , dcp.nro_fact
				 , dcp.co_sucu_in
				 , p.prov_des AS RAZON_SOCIAL
				 , CASE WHEN p.tipo_per = '1' OR p.tipo_per = '2'
								THEN '1'
								ELSE '2'
```
