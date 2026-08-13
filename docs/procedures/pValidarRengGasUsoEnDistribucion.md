# SP: pValidarRengGasUsoEnDistribucion
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pValidarRengGasUsoEnDistribucion
DESCRIPCION: Dado el rowguid de un renglón de factura de compra o plantilla de compra, determina si está siendo
			 usado en los gastos de al menos una Distribución de Gastos.
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 25/11/2014
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarRengGasUsoEnDistribucion]
    (
      @gRowGuid_Doc_Orig UNIQUEIDENTIFIER
    )
AS
    BEGIN
		SELECT
			SUM(monto_ap) AS monto_ap_total
		FROM
			saDistribCostoOrigenReng
		WHERE
			rowguid_comp = @gRowGuid_Doc_Orig OR rowguid_pcom = @gRowGuid_Doc_Orig		
	END
```
