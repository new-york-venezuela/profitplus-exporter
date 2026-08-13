# Trigger: TrigIU_saArtUnidad
**Tabla**: `saArtUnidad`

## Código (excerpt)
```sql
CREATE TRIGGER [dbo].[TrigIU_saArtUnidad] ON [dbo].[saArtUnidad] FOR INSERT, UPDATE AS 


IF @@rowcount != 0
BEGIN
	
	If Exists (select * from inserted where inserted.uni_principal = 1 and 
					exists ( Select * from saArtUnidad where saArtUnidad.co_art = inserted.co_art 
															and saArtUnidad.co_uni <> inserted.co_uni
															and saArtUnidad.uni_principal = 1))
	Begin
		RAISERROR('No se puede insertar dos unidades principales primarias para el mismo artículo.',16,1)
        ROLLBACK TRANSACTION
	End

	If Exists (select * from inserted where inserted.uni_secundaria = 1 and 
					exists ( Select * from saArtUnidad where saArtUnidad.co_art = inserted.co_art 
															and saArtUnidad.co_uni <> inserted.co_uni
															and saArtUnidad.uni_secundaria = 1))
	Begin
		RAISERROR('No se puede insertar dos unidades secundarias primarias para el mismo artículo.',16,1)
        ROLLBACK TRANSACTION
	End

END

```
