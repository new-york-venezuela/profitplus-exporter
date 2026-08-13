# SP: sp_ObtenerCamposPorGrupo
**Tipo**: Sistema
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[sp_ObtenerCamposPorGrupo]
    @grupoImpresora VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT campo1, campo2, campo3, val_str FROM saAdiCampo Where co_adigrupo = @grupoImpresora
END
```
