# SP: pv_ObtenerTarjetaBanco
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pv_ObtenerTarjetaBanco
*DESCRIPCIÓN	:	OBTIENE EL CODIGO DE BANCO/TARJETA Y SU DESCRIPCION MOSTRADOS PARA CREAR EL COBRO
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerTarjetaBanco]
(
	@Option BIT
)
AS
IF @Option = 0
	BEGIN
			SELECT co_ban codigo ,RTRIM(co_ban) + ' - ' + des_ban descripcion
				FROM saBanco
					ORDER BY 2 ASC
	END
ELSE
	BEGIN
			SELECT co_tar codigo , RTRIM(co_tar) + ' - ' + des_tar descripcion 
				FROM saTarjetaCredito
					ORDER BY 2 ASC
	END
```
