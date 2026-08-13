# Trigger: TrigEstado_saCaja
**Tabla**: `saCaja`

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <25/06/2010 09:44:46>
-- Description:	<Trigger cambio de estado inactivo/activo>
-- =============================================
CREATE TRIGGER [dbo].[TrigEstado_saCaja]
   ON  [dbo].[saCaja]  FOR INSERT,UPDATE 
AS 

IF @@rowcount != 0
BEGIN

	Declare @Id uniqueidentifier 
	Declare @EstadoNew bit
	Declare @EstadoOld bit	

	DECLARE curEstado CURSOR LOCAL FAST_FORWARD FOR 
	Select rowguid,inactivo from inserted

	OPEN curEstado
	FETCH NEXT FROM curEstado 
	INTO @Id, @EstadoNew

	WHILE @@FETCH_STATUS = 0
	BEGIN
		
		Select @EstadoOld = inactivo from deleted where deleted.rowguid = @Id

		If (@EstadoOld is null or @EstadoOld <> @EstadoNew)
		Begin
			Insert into saHistoricoEstado (	doc_orig, tipo_doc, Estado, fecha) values
				(@Id, 'saCaja',  cast(@EstadoNew as char(4)), getdate())
		End

		FETCH NEXT FROM curEstado 
		INTO @Id, @EstadoNew
	END 

	CLOSE curEstado
	DEALLOCATE curEstado
END

```
