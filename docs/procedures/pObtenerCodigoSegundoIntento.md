# SP: pObtenerCodigoSegundoIntento
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerCodigoSegundoIntento
*DESCRIPCIÓN	: Para busquedas asistidas, busca el código ingresado agregando ceroos a la izquierda
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pObtenerCodigoSegundoIntento]
    (
	  @sCampoCodigo CHAR(30) ,
      @sCodigo CHAR(20) ,  
      @sTabla CHAR(30) ,
	  @sTipoDoc CHAR(6) = NULL,
	  @bAux BIT
    )
AS 
	BEGIN
		
		DECLARE @len Decimal
		SET @len = 
		(SELECT     syscolumns.length 
		FROM         syscolumns INNER JOIN
                       sysobjects ON syscolumns.id = sysobjects.id INNER JOIN
                       systypes ON systypes.xtype = syscolumns.xtype
		WHERE     (sysobjects.name = @sTabla) AND (systypes.name <> 'sysname') AND (syscolumns.name = @sCampoCodigo))

		DECLARE @sql VARCHAR(MAX)

		SET @sql = 'SELECT TOP (1) ' + @sCampoCodigo + ' codigo
		FROM ' + @sTabla + '
		WHERE ' 
		
		IF (@bAux = 1)
		BEGIN
			SET @sql = @sql + ' co_tipo_doc = ''' + @sTipoDoc + ''' AND '
		END
		
		--SET @sql = @sql + '(' + @sCampoCodigo + ' = ''' + '[0]' +  rtrim(@sCodigo) + ''''	
		
		--wosuna situacion 109745
		SET @sql = @sql + '(' + @sCampoCodigo + ' = '''+ rtrim(@sCodigo) + ''''

		DECLARE @busq VARCHAR(MAX)
		SET @busq = '0' + @sCodigo
		  SET @busq =  @sCodigo
		--while @len - len(@sCodigo) > 1
		while @len - len(@sCodigo) > 0 --wosuna 109745
			BEGIN
				SET @busq = '0' + @busq
				SET @sql = @sql + ' OR ' + @sCampoCodigo + ' = ''' + rtrim(@busq) + ''''
				SET @len = @len -1
			end 
		SET @sql = @sql + ') ORDER BY ' + @sCampoCodigo + ' DESC'
	   EXEC (@sql)
    END
```
