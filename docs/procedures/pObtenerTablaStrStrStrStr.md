# SP: pObtenerTablaStrStrStrStr
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerTablaStrStrStrStr]
DESCRIPCION: Busca el primer, siguiente, anterior, ultimo registro de una tabla cuya clave primaria esta conforme
			por dos campos.
			@sCampoClave1 representa el valor del primer campo de la clave.
			@sColumna1 nombre de la primera columna para hacer la busqueda, clave primaria
			@sCampoClave2 representa el valor del segundo campo de la clave.
			@sColumna2 nombre de la segunda columna para hacer la busqueda, clave primaria
			@sCampoClave3 representa el valor del tercer campo de la clave.
			@sColumna3 nombre de la tercera columna para hacer la busqueda, clave primaria
			@iTipo 0 - Primero, 1 - Anterior, 2 - Siguiente, 3 - Ultimo
			@sTabla Nombre de la tabla
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerTablaStrStrStrStr]
    (
      @sCampoClave1 VARCHAR(20) = NULL ,
      @sColumna1 VARCHAR(20) ,
      @sCampoClave2 VARCHAR(20) = NULL ,
      @sColumna2 VARCHAR(20) ,
      @sCampoClave3 VARCHAR(20) = NULL ,
      @sColumna3 VARCHAR(20) ,
      @sCampoClave4 VARCHAR(20) = NULL ,
      @sColumna4 VARCHAR(20) ,
      @iTipo INT ,
      @sTabla VARCHAR(30)
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(1200) ,
            @sParametro NVARCHAR(500) 
        SET @sParametro = N'@sCampoClave11 varchar(20), @sCampoClave22 varchar(20), @sCampoClave33 varchar(20), @sCampoClave44 varchar(20)' 
		
	-- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ',' + @sColumna3 + ',' + @sColumna4
                    + ' FROM  ' + @sTabla + ' ORDER BY ' + @sColumna1 + ',' + @sColumna2 + ',' + @sColumna3 + ','
                    + @sColumna4
            END	

	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ',' + @sColumna3 + ',' + @sColumna4
                    + ' FROM  ' + @sTabla + ' 
			WHERE (((' + @sColumna1 + ' < @sCampoClave11) OR 
				  ((' + @sColumna1 + ' = @sCampoClave11) AND (' + @sColumna2 + ' < @sCampoClave22)) OR
				  ((' + @sColumna1 + ' = @sCampoClave11) AND (' + @sColumna2 + ' = @sCampoClave22) AND
					(' + @sColumna3 + ' < @sCampoClave33)) OR
					((' + @s
```
