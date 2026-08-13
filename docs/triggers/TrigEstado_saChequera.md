# Trigger: TrigEstado_saChequera
**Tabla**: `saChequera`

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <20100614 09:44:46>
-- Date		  : 12/07/2010
-- =============================================
CREATE TRIGGER [dbo].[TrigEstado_saChequera]
   ON  [dbo].[saChequera]  FOR INSERT,UPDATE
AS 

IF @@rowcount != 0
BEGIN

	Declare @Id uniqueidentifier 
	Declare @EstadoNew char(3)
	Declare @EstadoOld char(3)

	DECLARE curEstado CURSOR LOCAL FAST_FORWARD FOR 
	Select rowguid,status from inserted

	OPEN curEstado
	FETCH NEXT FROM curEstado 
	INTO @Id, @EstadoNew

	WHILE @@FETCH_STATUS = 0
	BEGIN
		
		Select @EstadoOld = status from deleted where deleted.rowguid = @Id 

		If (@EstadoOld is null or @EstadoOld <> @EstadoNew)
		Begin
			Insert into saHistoricoEstado (	doc_orig, tipo_doc, Estado, fecha) values
				(@Id, 'saChequera',  cast(@EstadoNew as char(4)), getdate())
		End

		FETCH NEXT FROM curEstado 
		INTO @Id, @EstadoNew
	END 

	CLOSE curEstado
	DEALLOCATE curEstado
END

```
