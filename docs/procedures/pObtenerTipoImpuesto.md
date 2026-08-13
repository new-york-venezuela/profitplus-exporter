# SP: pObtenerTipoImpuesto
**Tipo**: Obtener
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVenta`](../tables/saImpuestoSobreVenta.md)
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*CREADO			:	<2011-12-12>
*MODIFICADO		:	<2020-07-27>
*NOMBRE			: pObtenerTipoImpuesto
*DESCRIPCIÓN	: Busca un tipo de impuesto a una fecha al darle una tasa
*AUTOR			: Softech Sistemas
************************************************************************/

CREATE PROCEDURE [dbo].[pObtenerTipoImpuesto]
    (
      @dPorc_Tasa	DECIMAL(18,5) ,
      @bVentas		BIT ,
      @dtFecha		SMALLDATETIME
    )
AS 
    BEGIN
        DECLARE @fecha datetime
		
		SET @fecha = (SELECT TOP(1) saImpuestoSobreVentaReng.fecha 
		FROM saImpuestoSobreVentaReng 
		INNER JOIN saImpuestoSobreVenta on saImpuestoSobreVenta.fecha = saImpuestoSobreVentaReng.fecha 
		WHERE saImpuestoSobreVentaReng.fecha <= @dtFecha 
		AND ventas = 1
		ORDER BY saImpuestoSobreVentaReng.fecha DESC)
		
		SELECT tipo_imp FROM saImpuestoSobreVentaReng WHERE fecha = @fecha AND porc_tasa = @dPorc_Tasa
    END
```
