# SP: pv_ObtenerCuentasBancarias
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pv_ObtenerCuentasBancaria
*DESCRIPCIÓN	:	OBTIENE EL CODIGO DE CUENTAS BANCARIAS Y SU DESCRIPCION MOSTRADOS PARA LLENAR COMBOS DE CUENTAS BANCARIAS
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerCuentasBancarias]
(@sCo_Mone CHAR(6))
AS

			SELECT cod_cta codigo ,num_cta descripcion
				FROM saCuentaBancaria
					Where inactivo = 0 AND co_mone = @sCo_Mone
						ORDER BY 2 ASC
```
