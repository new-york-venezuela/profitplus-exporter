# Trigger: ValidarsaArtCrearAut
**Tabla**: `saArtCrearAut`

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <25/11/2023 09:44:46>
-- Description:	<Se ejecutara en la tabla saArtCrearAut para validar que no se repita el co_art>
-- =============================================
CREATE TRIGGER ValidarsaArtCrearAut
   ON  saArtCrearAut
--Se ejecutara Despues de un Insert o un Update a la tabla
   AFTER  INSERT,UPDATE
AS 
BEGIN
       SET NOCOUNT ON;

DECLARE @consecutivo CHAR(30)
DECLARE @Existe int 
    SELECT TOP(1)  @consecutivo =  co_artCrearAut from saArtCrearAut order by fe_us_in desc

       SELECT @Existe = COUNT(co_artCrearAut) from saArtCrearAut WHERE co_artCrearAut = @consecutivo

    IF (@Existe > 1) BEGIN

        RAISERROR ('Ya existe un registro con el mismo código.',
                                                 -- Message text.  
                   16,                           -- Severity.  
                   1                             -- State.  
                   ) 

               ROLLBACK TRANSACTION
             END 

END

```
