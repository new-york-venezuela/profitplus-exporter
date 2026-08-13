# SP: RepListadoComprasCreditoFiscal
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saArtImportacion`](../tables/saArtImportacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saDevolucionProveedorRengExt`](../tables/saDevolucionProveedorRengExt.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaCompraRengExt`](../tables/saFacturaCompraRengExt.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	[RepListadoComprasCreditoFiscal]
-- DESCRIPCION	:	Obtiene los datos para el Reporte Listado de Compras con sus Créditos Fiscales
-- CREADO POR	:	SOFTECH SISTEMAS
-- LAST DATE	:	2017-06-27
-- =============================================
CREATE PROCEDURE [dbo].[RepListadoComprasCreditoFiscal] 
	-- Add the parameters for the stored procedure here
	(
		@sCo_fecha_d	SMALLDATETIME	= NULL ,
		@sCo_fecha_h	SMALLDATETIME	= NULL ,
		@cCo_Sucursal	CHAR(6)			= NULL ,
		@sCo_Prov_d		CHAR(16)		= NULL ,
		@sCo_Prov_h		CHAR(16)		= NULL ,
        @bHeaderRep     BIT = 0 
	)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = DATEADD(ss, -60, DATEADD(day, 1, @sCo_fecha_h))

    -- Insert statements for procedure here	
	SELECT * FROM (
	--Facturas de Compra		
		SELECT DoCo.nro_doc, DoCo.co_tipo_doc, [dbo].[FechaSimple](DoCo.fec_emis) AS fec_emis, 
			   [dbo].[FechaSimple](D_FTNac.fec_emis) AS fec_Nac,
			   Prov.co_prov, Prov.rif, Prov.prov_des, DoCo.nro_fact, null AS nro_Nota, 
			   
			   CASE WHEN FaRe.reng_num = 1 THEN
                       
                           CASE WHEN DI.fact_num IS NULL THEN
                                  DoCo.total_neto
                           ELSE
                                  (
                                  -- BASE IMPONIBLE
                                        (SELECT (SUM(base_imp) + SUM(der_impor_neto) + SUM(tasa_regimenAplic_neto) + SUM(otrosGravables_neto))
                                               FROM ObtenerMontosColumnaImportacion(DoCo.nro_doc)) --BASE IMPONIBLE
                                  +
                                  -- MONTO IMPUESTO
                                        ISNULL((SELECT SUM(monto_imp)
                                        FROM [dbo].[ObtenerMontosColumnaImportacion](DoCo.nro_doc)), 0.00000) -- MONTO IMPUESTO
                                  )
                           END

                       ELSE 0 END total_neto,


			   FaRe.reng_num, FaRe.co_art, Art.art_des,
	   	   
			--Cuando esta asociada a una FTN
			CASE 
				WHEN DI.fact_num IS NOT NULL 
				THEN
					CASE 
						WHEN DI.tasa_valor <> 0 
						THEN 0
						ELSE FaRe.reng_neto 
					END
			--Cuando no esta asociada a una FTN
			ELSE
				CASE 
					W
```
