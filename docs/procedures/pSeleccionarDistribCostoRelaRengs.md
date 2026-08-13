# SP: pSeleccionarDistribCostoRelaRengs
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pSeleccionarDistribCostoRelaRengs
*DESCRIPCIÓN	: Devuelve la distribución detallada
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarDistribCostoRelaRengs]
	@sDistrib_Num CHAR(20)
AS
	BEGIN
		SET NOCOUNT ON;

		SELECT
            DCDR.rowguid AS Rowguid_Art, DCOR.rowguid AS Rowguid_Gas, DCRR.monto AS Monto
        FROM
            saDistribCostoRelaReng DCRR
			INNER JOIN saDistribCostoOrigenReng DCOR ON DCOR.reng_num = DCRR.reng_num_origen AND DCOR.distrib_num = DCRR.distrib_num_origen
			INNER JOIN saDistribCostoDestinoReng DCDR ON DCDR.reng_num = DCRR.reng_num_destino AND DCDR.distrib_num = DCRR.distrib_num_destino
		WHERE
			DCRR.distrib_num_origen = @sDistrib_Num
	END
```
