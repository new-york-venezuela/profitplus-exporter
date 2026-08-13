# SP: RepTotalVentaxClienteMultimoneda
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18/08/2010>
-- Description:	<Reporte de Total de Ventas por Cliente>
-- =============================================
CREATE PROCEDURE [dbo].[RepTotalVentaxClienteMultimoneda]


    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
	@cCo_Moneda_Rep CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

	
        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)
	
			DECLARE @MonedaBase char(6)
		 SELECT @MonedaBase = g_moneda from par_emp

		IF (@cCo_Moneda_Rep is null)
		    SET @cCo_Moneda_Rep = @MonedaBase
	





select fact.fec_emis,       
                            Sum(fact.total_neto) as total_neto,
                             SUM(fact.monto_imp) as monto_imp , 
							 Sum (fact.otros)  as otros , 
							 SUM(fact.TotalFactura)  as TotalFactura, 
							 Sum(round(fact.TotalFactura / fact.tasa ,2))  as TotalFacturaOM,
	                         Sum(fact.neto_dev)  as neto_dev, 
							 SUM (fact.imp_dev)  as imp_dev,    
							 Sum(fact.otros_dev)  as otros_dev, 
							 Sum(fact.TotalDev)  as TotalDev , 
							 Sum(round(fact.TotalDev /fact.tasa ,2))  as TotalDevOM,
                             Sum(fact.total_neto) - Sum(fact.neto_dev)  as Montos_Ventas_Netas, 
						     sum( (fact.monto_imp - fact.imp_dev) ) as Iva_Compras_Netas,
					         sum( ( fact.otros-fact.otros_dev))  as Otros_Compras_Netas,
					         sum(  (fact.TotalFactura -  fact.TotalDev))  as NetoBase , 
					         sum( round((fact.TotalFactura -  fact.TotalDev) /   fact.tasa ,2)) as NetoOM, @cCo_Moneda_Rep as co_mone_rep , @MonedaBase as MonedaBase, fact.co_cli,fact.cli_des

	from (
        SELECT
            FORMAT(FC.fec_emis,'yyyyMM') as fec_emis,
			SUM(Round(( CASE WHEN FC.anulado = 1 THEN 0.00
                                ELSE ( 
								CASE WHEN @cCo_Moneda_Rep = FC.co_mone TH
```
