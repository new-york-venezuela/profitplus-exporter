# SP: pvGetConfigEmpresaAdmi
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
CREATE Procedure [dbo].[pvGetConfigEmpresaAdmi]
AS
BEGIN
	Select	g_moneda as MonedaBase,
			i_dec_stock as decimalexistencia,
			i_dec_precio as decimalprecio, 
			ltrim(rtrim(v_valor_redondeo)) as decimalTotal,
			ltrim(rtrim(v_tipo_redondeo)) as tipoRedondeo,
			v_max_reng as max_lin,
			p_desc_glo as descGlob,
			logo,
			percepcion_igtf

	From par_emp
END
```
