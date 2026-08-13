# Trigger: TrigDelete_saNotaEntregaVenta
**Tabla**: `saNotaEntregaVenta`

## Código (excerpt)
```sql
CREATE TRIGGER [dbo].[TrigDelete_saNotaEntregaVenta]     ON  [dbo].[saNotaEntregaVenta]     INSTEAD OF  DELETE  AS  BEGIN  IF (ROWCOUNT_BIG() = 0) RETURN RAISERROR ('El registro no debe ser borrado.' ,10,1)    ROLLBACK TRANSACTION  END  
```
