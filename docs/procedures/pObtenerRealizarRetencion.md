# SP: pObtenerRealizarRetencion
**Tipo**: Obtener
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerRealizarRetencion] ( @sCo_Tipo_Doc CHAR(4) )
AS 
    BEGIN
	
        SELECT
            aplica_riva_compra
        FROM
            satipoDocumento
        WHERE
            co_tipo_Doc = @sCo_Tipo_Doc

    END
```
