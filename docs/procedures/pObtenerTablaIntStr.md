# SP: pObtenerTablaIntStr
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerTablaIntStr]
DESCRIPCION: Busca el primer, siguiente, anterior, ultimo registro de una tabla cuya clave primaria esta conforme
			por dos campos.
			@iCampoClave1 representa el valor del campo base en formato entero.
			@sColumna1 nombre de la columna para hacer la busqueda, clave primaria
			@iCampoClave2 representa el valor del campo secundario en de texto.
			@sColumna2 nombre de la columna para hacer la busqueda, clave secundaria
			@iTipo 0 - Primero, 1 - Anterior, 2 - Siguiente, 3 - Ultimo
			@sTabla Nombre de la tabla
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerTablaIntStr]
    (
      @iCampoClave1 INT = NULL ,
      @sColumna1 VARCHAR(20) ,
      @sCampoClave2 VARCHAR(20) = NULL ,
      @sColumna2 VARCHAR(20) ,
      @iTipo INT ,
      @sTabla VARCHAR(30)
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(1500) ,
            @sParametro NVARCHAR(500) ,
            @sContienePk NVARCHAR(100)
        SET @sParametro = N'@iCampoClave int' 
        SET @sContienePk = CASE @sCampoClave2
                             WHEN NULL THEN N' 1=1 '
                             ELSE N' (' + @sColumna2 + ' = ''' + @sCampoClave2 + ''') '
                           END
	-- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ', ' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE '
                    + @sContienePk + ' ORDER BY ' + @sColumna1   
            END	
	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ', ' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE ('
                    + @sColumna1 + ' < @iCampoClave) AND ' + @sContienePk + ' ORDER BY ' + @sColumna1 + ' DESC'
            END	
	-- Anterior o Igual
        IF @iTipo = 4 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ', ' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE ('
                    + @sColumna1 + ' <= @iCampoClave) AND ' + @sContienePk + ' ORDER BY ' + @sColumna1 + ' DESC'
            END	
	-- Siguiente
        IF @iTipo = 2 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ', ' + @sColumna2 + ' FROM  ' + @sT
```
