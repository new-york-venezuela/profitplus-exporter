# SP: pValidarRengArtUsoEnDistribucion
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/*************************************************************************************************
NOMBRE:	pValidarRengArtUsoEnDistribucion
DESCRIPCION: Dado el rowguid de un renglón de factura de compra, determina si está siendo
			 usado en los artículos de al menos una Distribución de Gastos.
CREADO POR: SOFTECH SISTEMAS
CREADO EL: 25/11/2014
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pValidarRengArtUsoEnDistribucion]
    (
      @gRowGuid_Doc_Orig UNIQUEIDENTIFIER
    )
AS
    BEGIN
		SELECT TOP 1
			DCDR.distrib_num AS distrib_num, ISNULL(DCRR.tipo_distrib,'') AS tipo_distrib
		FROM
			saDistribCostoDestinoReng DCDR
			INNER JOIN saDistribCosto DC ON DC.distrib_num = DCDR.distrib_num
			LEFT JOIN saDistribCostoRelaReng DCRR ON DCRR.distrib_num_destino = DCDR.distrib_num
			AND DCRR.reng_num_destino = DCDR.reng_num
		WHERE
			DC.anulado = 0 AND
			DCDR.rowguid_comp = @gRowGuid_Doc_Orig
		ORDER BY DCDR.distrib_num ASC
	END
```
