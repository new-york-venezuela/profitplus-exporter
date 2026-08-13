# SP: pvGetConfigUsuario
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvConfigPuntoV`](../tables/pvConfigPuntoV.md)

## Código (excerpt)
```sql
CREATE Procedure [dbo].[pvGetConfigUsuario]
	(		
		@sCodUser char(6),
		@sCodMapa char(6)
	)
AS
BEGIN

	if exists (select * from pvConfigPuntoV where co_usuario = @sCodUser)
		select * from pvConfigPuntoV where co_usuario = @sCodUser
	Else
		select * from pvConfigPuntoV where co_mapa = @sCodMapa	
		
END
```
