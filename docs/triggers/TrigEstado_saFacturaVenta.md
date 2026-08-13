# Trigger: TrigEstado_saFacturaVenta
**Tabla**: `saFacturaVenta`

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <20100614 09:44:46>
-- Description:	<Inserta una traza cada vez que cambia el estado de la factura (Campo anulado>
-- Date		  : 30/06/2010
-- =============================================
CREATE TRIGGER [dbo].[TrigEstado_saFacturaVenta]
   ON  [dbo].[saFacturaVenta]  FOR INSERT,UPDATE
AS 

IF @@rowcount != 0
BEGIN

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
				(@Id, 'saFacturaVenta',  cast(@EstadoNew as char(4)), getdate())
		End

		FETCH NEXT FROM curEstado 
		INTO @Id, @EstadoNew
	END 

	CLOSE curEstado
	DEALLOCATE curEstado
END

```
