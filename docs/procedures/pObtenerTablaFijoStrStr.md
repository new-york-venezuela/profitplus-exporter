# SP: pObtenerTablaFijoStrStr
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerTablaFijoStrStr
DESCRIPCION: Busca el primer, siguiente, anterior, ultimo registro de una tabla cuya clave primaria esta conforme
			por dos campos.
			@sCampoClave1 representa el valor del primer campo de la clave.
			@sColumna1 nombre de la primera columna para hacer la busqueda, clave primaria
			@sCampoClave2 representa el valor del segundo campo de la clave.
			@sColumna2 nombre de la segunda columna para hacer la busqueda, clave primaria
			@iTipo 0 - Primero, 1 - Anterior, 2 - Siguiente, 3 - Ultimo
			@sTabla Nombre de la tabla
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerTablaFijoStrStr]
    (
      @sCampoClave1 VARCHAR(20) = NULL ,      
      @sColumna1 VARCHAR(20) ,
      @sCampoClave2 VARCHAR(20) = NULL ,
	  @gCampoClave1 VARCHAR(64) = NULL ,      
      @sColumna2 VARCHAR(20) ,
      @iTipo INT ,
      @sTabla VARCHAR(30)
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(1200) ,
            @sParametro NVARCHAR(500) 
			if (@gCampoClave1 IS NOT NULL)
				begin
					SET @sParametro = N'@sCampoClave11 varchar(64), @sCampoClave22 varchar(20)' 
				end
			else
				begin
					SET @sParametro = N'@sCampoClave11 varchar(20), @sCampoClave22 varchar(20)' 
				end
		
		
	-- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE '
                    + @sColumna1 + ' = @sCampoClave11 ORDER BY ' + @sColumna2
            END	

	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE ('
                    + @sColumna1 + ' = @sCampoClave11 AND ' + @sColumna2 + ' < @sCampoClave22) ORDER BY ' + @sColumna2
                    + ' DESC'
            END	
	
	-- Siguiente
        IF @iTipo = 2 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE ('
                    + @sColumna1 + ' = @sCampoClave11 AND ' + @sColumna2 + ' > @sCampoClave22) ORDER BY ' + @sColumna2
            END 
	
	-- Ultimo
        IF @iTipo = 3 
            BEGIN
                SET @sSql
```
