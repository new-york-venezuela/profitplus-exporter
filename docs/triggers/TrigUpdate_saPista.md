# Trigger: TrigUpdate_saPista
**Tabla**: `saPista`

## Código (excerpt)
```sql
CREATE TRIGGER [dbo].[TrigUpdate_saPista] ON [dbo].[saPista] INSTEAD OF UPDATE AS BEGIN RAISERROR ('No se puede actualizar el registro.', 16, 1); ROLLBACK TRANSACTION;    END
```
