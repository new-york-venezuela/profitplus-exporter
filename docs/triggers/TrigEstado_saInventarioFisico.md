# Trigger: TrigEstado_saInventarioFisico
**Tabla**: `saInventarioFisico`

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <20100614 09:44:46>
-- Date		  : 16/07/2010
-- =============================================
CREATE TRIGGER [dbo].[TrigEstado_saInventarioFisico]
   ON  [dbo].[saInventarioFisico]  FOR INSERT,UPDATE
AS 

IF @@rowcount != 0
BEGIN

	Declare @Id uniqueidentifier 
	Declare @EstadoNew bit
	Declare @EstadoOld bit	

	DECLARE curEstado CURSOR LOCAL FAST_FORWARD FOR 
	Select rowguid,procesado  from inserted

	OPEN curEstado
	FETCH NEXT FROM curEstado 
	INTO @Id, @EstadoNew

	WHILE @@FETCH_STATUS = 0
	BEGIN
		
		Select @EstadoOld = procesado  from deleted where deleted.rowguid = @Id 

		If (@EstadoOld is null or @EstadoOld <> @EstadoNew)
		Begin
			Insert into saHistoricoEstado (	doc_orig, tipo_doc, Estado, fecha) values
				(@Id, 'saInventarioFisico',  cast(@EstadoNew as char(4)), getdate())
		End

		FETCH NEXT FROM curEstado 
		INTO @Id, @EstadoNew
	END 

	CLOSE curEstado
	DEALLOCATE curEstado
END

```
