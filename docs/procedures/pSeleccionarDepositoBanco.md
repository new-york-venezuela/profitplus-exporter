# SP: pSeleccionarDepositoBanco
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarDepositoBanco
DESCRIPCION	: Selleciona un registro de la tabla saDepositoBanco segun su codigo
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarDepositoBanco] ( @sDep_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            *, 
            (select top(1) porc_tasa from saImpuestoSobreVentaReng
			 where tipo_imp = 1 order by fecha desc) as Porc_Iva,
			(select (cb.co_mone) from saCuentaBancaria cb
			inner join saDepositoBanco db on db.dep_num = @sDep_Num and cb.cod_cta = db.cod_cta) as Cod_Moneda
        FROM
            saDepositoBanco
        WHERE
            dep_num = @sDep_Num
    END
```
