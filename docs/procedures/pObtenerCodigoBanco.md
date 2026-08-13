# SP: pObtenerCodigoBanco
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
/******************************************************************************
* Stored Procedure : Obtiene el código del banco					              *
* Fecha Creación   :  09/09/2016                                            *
*
******************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerCodigoBanco]
	(		
		@sCod_cuenta char(4)
	)
AS
BEGIN

	SELECT co_ban 
	FROM 
		saCuentaBancaria 
	WHERE 
		cod_cta = @sCod_cuenta
	
END
```
