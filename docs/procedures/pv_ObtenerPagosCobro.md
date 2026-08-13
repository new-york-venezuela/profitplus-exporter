# SP: pv_ObtenerPagosCobro
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)

## Código (excerpt)
```sql
/********************************************************************************
* Fecha Creación   :  29/09/2016												*
* Autor: Mantenimiento de Productos Sit. #809809								*
* descripcion:																	*
*		procedimiento hecho para 8.0 que obtiene los pagos asociados a un cobro	*
* parametros:																	*
*		@Cob_num ->	Parametro que indica el numero del cobro					*
*********************************************************************************/
CREATE PROCEDURE [dbo].[pv_ObtenerPagosCobro]
	@sCob_num VARCHAR (20)
AS
BEGIN
	SELECT
        forma_pag sFormaPago, isnull(SUM(mont_doc),0.00) dMonto
    FROM
        saCobroTPReng tp
	WHERE
		cob_num = @sCob_num
	GROUP BY
		forma_pag
END
```
