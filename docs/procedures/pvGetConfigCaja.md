# SP: pvGetConfigCaja
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
CREATE Procedure [dbo].[pvGetConfigCaja]
	(		
		@sCodCaja char(6)
	)
AS
BEGIN

		select * from saCaja 
		where cod_caja = @sCodCaja and
		inactivo = 0
END
```
