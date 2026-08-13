# SP: pObtenerTablaSmallDate
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerTablaSmallDate
DESCRIPCION: Busca el primer, siguiente, anterior, ultimo registro de una tabla cuya clave primaria esta conforme
			por un solo campo.
			@sCampoClave1 representa el valor del campo base.
			@sColumna1 nombre de la columna para hacer la busqueda, clave primaria
			@iTipo 0 - Primero, 1 - Anterior, 2 - Siguiente, 3 - Ultimo
			@sTabla Nombre de la tabla
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerTablaSmallDate]
    (
      @sdCampoClave1 SMALLDATETIME ,
      @sColumna1 VARCHAR(20) ,
      @iTipo INT ,
      @sTabla VARCHAR(30)
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(600) ,
            @sParametro NVARCHAR(500) 
        SET @sParametro = N'@sdCampoClave SMALLDATETIME ' 

	-- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ' FROM  ' + @sTabla + ' ORDER BY ' + @sColumna1   
            END	

	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ' FROM  ' + @sTabla + ' WHERE (' + @sColumna1
                    + ' < @sdCampoClave) ORDER BY ' + @sColumna1 + ' DESC'
            END	

	-- Anterior o Igual
        IF @iTipo = 4 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ' FROM  ' + @sTabla + ' WHERE (' + @sColumna1
                    + ' <= @sdCampoClave) ORDER BY ' + @sColumna1 + ' DESC'
            END	

	-- Siguiente
        IF @iTipo = 2 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ' FROM  ' + @sTabla + ' WHERE (' + @sColumna1
                    + ' > @sdCampoClave) ORDER BY ' + @sColumna1
            END 

	-- Siguiente Igual
        IF @iTipo = 5 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ' FROM  ' + @sTabla + ' WHERE (' + @sColumna1
                    + ' >= @sdCampoClave) ORDER BY ' + @sColumna1
            END 

	-- Ultimo
        IF @iTipo = 3 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ' FROM  ' + @sTabla + ' ORDER BY ' + @sColumna1 + ' DESC '   
            END

        EXEC sp_executesql @sSql, @sParametro, @sdCampoClave = @sdCampoClav
```
