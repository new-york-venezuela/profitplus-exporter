# SP: pv_VerificarCampoAdicionalDecimal
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: pv_VerificarCampoAdicionalDecimal
*DESCRIPCIÓN	: Busca el campo val_fecha en la tabla saAdiCampo
*AUTOR			: Softech Sistemas
************************************************************************/
CREATE PROCEDURE [dbo].pv_VerificarCampoAdicionalDecimal
    (
      @sCo_AdiGrupo CHAR(8) ,
      @sCo_AdiCampo CHAR(8) 
    )
AS 
    BEGIN
        SELECT TOP 1 
			val_fecha
		FROM 
			saAdiCampo
		WHERE 
			co_adigrupo = @sCo_AdiGrupo AND 
			co_adicampo = @sCo_AdiCampo
    END
```
