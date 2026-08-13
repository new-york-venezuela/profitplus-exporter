# SP: pObtenerListadoDatos
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerListadoDatos]
DESCRIPCION: Obtiene el ultimo costo para un artículo de un almacén
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerListadoDatos]
    (
      @sDatabase_Name VARCHAR(30) = NULL ,
      @sTable_Name VARCHAR(50) = NULL ,
      @sField_Name VARCHAR(30) = NULL ,
      @sValor VARCHAR(30) = NULL ,
      @iOpcion INT
    )
AS 
    BEGIN	

        DECLARE @SqlString NVARCHAR(MAX)

        SET @SqlString = N'USE ' + CONVERT(NVARCHAR(100), @sDataBase_Name) + ' SELECT TOP(500) *    
					   FROM ' + CONVERT(NVARCHAR(100), @sTable_Name) + ' WHERE '

        IF ( @iOpcion = 0 )--Inicia en
            BEGIN
                SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE '''
                    + CONVERT(NVARCHAR(30), @sValor) + '%''' ;
            END

        IF ( @iOpcion = 1 )--Termina en
            BEGIN
                SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
                    + CONVERT(NVARCHAR(30), @sValor) + '''' ;
            END

        IF ( @iOpcion = 2 )--Contiene
            BEGIN
                SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' LIKE ''%'
                    + CONVERT(NVARCHAR(30), @sValor) + '%''' ;
            END
	
        IF ( @iOpcion = 3 )--Es Igual
            BEGIN
                SET @SqlString = @SqlString + CONVERT(NVARCHAR(100), @sField_Name) + N' = '''
                    + CONVERT(NVARCHAR(30), @sValor) + '''' ;
            END
	
        IF ( @iOpcion = 4 )--Fonetica
            BEGIN
                SET @SqlString = @SqlString + N' dbo.SoundexBusqueda(' + CONVERT(NVARCHAR(100), @sField_Name) + N','''
                    + CONVERT(NVARCHAR(30), @sValor) + N''') > 3' ;
            END

	   EXEC sp_executesql @SQLString
    END
```
