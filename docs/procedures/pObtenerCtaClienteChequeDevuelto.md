# SP: pObtenerCtaClienteChequeDevuelto
**Tipo**: Obtener
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			:	pObtenerCtaClienteChequeDevuelto
*DESCRIPCION	:	Obtiene la Cuenta de Ingresos/Egresos del cliente 
*CREADO			:	SOFTECH SISTEMAS
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerCtaClienteChequeDevuelto]
    (
      @sCodCliente CHAR(16) 
    )
AS 
    BEGIN

		SELECT co_cta_ingr_egr 
	
		FROM saCliente 
	
		WHERE co_cli = @sCodCliente
       

    END
```
