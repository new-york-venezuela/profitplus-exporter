# Trigger: TrigDelete_saPista
**Tabla**: `saPista`

## Código (excerpt)
```sql
CREATE TRIGGER [dbo].[TrigDelete_saPista]     ON  [dbo].[saPista]     INSTEAD OF  DELETE  AS  BEGIN  IF (ROWCOUNT_BIG() = 0) RETURN  RAISERROR ('El registro no debe ser borrado.' ,10,1)    ROLLBACK TRANSACTION  END  
```
