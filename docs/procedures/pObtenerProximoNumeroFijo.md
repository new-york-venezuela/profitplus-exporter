# SP: pObtenerProximoNumeroFijo
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerProximoNumero
DESCRIPCION: Devuelve el proximo numero de una tabla con primary key compuesto
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerProximoNumeroFijo]
    (
      @sTabla VARCHAR(50) ,
      @sCampo VARCHAR(50) ,
      @sCampoFijo VARCHAR(50) ,
      @sValorFijo VARCHAR(50) ,
      @sPrefijo VARCHAR(50) = NULL
	
    )
AS 
    BEGIN
        DECLARE @sStringCommand VARCHAR(8000)
	
        SET @sPrefijo = ISNULL(@sPrefijo, '')
        SET @sStringCommand = N'DECLARE @sResult VarChar(20), @iLen Int
	SELECT @sResult = MAX(' + @sCampo + ') FROM ' + @sTabla + ' WHERE ' + @sCampoFijo + ' = ' + @sValorFijo + ' AND '
            + @sCampo + ' LIKE ''' + RTRIM(@sPrefijo) + '[0-9]%' + ''' And patindex(''%[^0-9]%'',substring(' + @sCampo
            + ',' + LTRIM(STR(LEN(@sPrefijo) + 1)) + ',40) + space(1)) > len(substring(' + @sCampo + ','
            + LTRIM(STR(LEN(@sPrefijo) + 1)) + ',40)) AND LEN(' + @sCampo + ') =
	(SELECT  MAX(LEN(' + @sCampo + ')) FROM ' + @sTabla + ' WHERE ' + @sCampoFijo + ' = ' + @sValorFijo + ' AND '
            + @sCampo + ' LIKE ''' + RTRIM(@sPrefijo) + '[0-9]%' + ''')

	IF @sResult IS NULL
	Begin
	   SELECT @iLen = ISNULL(MAX(LEN(' + @sCampo + ')),6) FROM ' + @sTabla + '
	End
	
	SELECT @iLen As Longitud, @sResult As Codigo'
        EXEC(@sStringCommand)
    END
```
