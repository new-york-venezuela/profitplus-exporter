# SP: pv_VerificarCampoAdicionalCadena
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/**********************************************************************
--NOMBRE		: pv_VerificarCampoAdicionalCadena
--AUTOR			: Softech Sistemas
--Create Date   : 2017-10-06
--DESCRIPCIÓN	: Busca el campo val_str en la tabla saAdiCampo
**********************************************************************/
CREATE PROCEDURE [dbo].[pv_VerificarCampoAdicionalCadena]
    (
      @sCo_AdiGrupo CHAR(8) ,
      @sCo_AdiCampo CHAR(8) 
    )
AS 
    BEGIN
        SELECT TOP 1 
			val_str
		FROM 
			saAdiCampo
		WHERE 
			co_adigrupo = @sCo_AdiGrupo AND 
			co_adicampo = @sCo_AdiCampo
    END
```
