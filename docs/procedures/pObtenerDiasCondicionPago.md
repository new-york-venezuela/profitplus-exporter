# SP: pObtenerDiasCondicionPago
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)

## Código (excerpt)
```sql
/***********************************************************************************************
*NOMBRE			:		pObtenerDiasCondicionPago
*AUTOR			:		SOFTECH SISTEMAS.
*DESCRIPCIÓN	:		Obtiene los dias de credito de una condicion de pago dada
************************************************************************************************/

CREATE PROCEDURE [pObtenerDiasCondicionPago]
    (
      @sCo_Cond CHAR(6) 
    )
AS 
    BEGIN

       SELECT dias_cred FROM saCondicionPago WHERE co_cond = @sCo_Cond
          

    END
```
