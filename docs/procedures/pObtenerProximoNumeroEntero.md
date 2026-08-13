# SP: pObtenerProximoNumeroEntero
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
CREATE PROCEDURE [pObtenerProximoNumeroEntero]
    (
      @sTabla VARCHAR(50) ,
      @sCampo VARCHAR(50)
    )
AS 
    BEGIN

        DECLARE @sStringCommand VARCHAR(8000)
        SET @sStringCommand = N'DECLARE @sResult VarChar(20), @iLen Int
						SELECT MAX(' + @sCampo + ') + 1 FROM  ' + @sTabla + ''

        EXEC(@sStringCommand)
    END
```
