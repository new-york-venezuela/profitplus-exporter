# SP: UpdateLog
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[UpdateLog] AS
declare @File as varchar(250),@exe as varchar(250)
select @File=DB_NAME()
CHECKPOINT
set @File=rtrim(ltrim(@File))
set @exe='BACKUP LOG '+ @File +' WITH TRUNCATE_ONLY'
exec(@exe)
SELECT @File= name FROM dbo.sysfiles WHERE (status & 0x40) <> 0
set @File=rtrim(ltrim(@File))
set @exe='DBCC SHRINKFILE (N'''+@File+''')'
exec(@exe)
```
