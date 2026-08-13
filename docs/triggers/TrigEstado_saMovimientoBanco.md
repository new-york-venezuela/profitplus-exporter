# Trigger: TrigEstado_saMovimientoBanco
**Tabla**: `saMovimientoBanco`

## Código (excerpt)
```sql
-- =============================================
-- Author:		<>
-- Create date: <05/19/2010 09:44:46>
-- Description:	<>
-- =============================================
CREATE TRIGGER [dbo].[TrigEstado_saMovimientoBanco]
   ON  [dbo].[saMovimientoBanco]  FOR INSERT,UPDATE
AS 

IF @@rowcount != 0
BEGIN
SET NOCOUNT ON
	
	Declare @Id uniqueidentifier 
	Declare @EstadoNew bit
	Declare @EstadoOld bit	

	DECLARE curEstado CURSOR LOCAL FAST_FORWARD FOR 
	Select rowguid,anulado from inserted

	OPEN curEstado
	FETCH NEXT FROM curEstado 
	INTO @Id, @EstadoNew

	WHILE @@FETCH_STATUS = 0
	BEGIN
		
		Select @EstadoOld = anulado from deleted where deleted.rowguid = @Id 

		If (@EstadoOld is null or @EstadoOld <> @EstadoNew)
		Begin
			Insert into saHistoricoEstado (	doc_orig, tipo_doc, Estado, fecha) values
				(@Id, 'saMovimientoBanco',  cast(@EstadoNew as char(4)), getdate())
		End

		FETCH NEXT FROM curEstado 
		INTO @Id, @EstadoNew
	END 

	CLOSE curEstado
	DEALLOCATE curEstado
	
	SET NOCOUNT OFF
END

```
