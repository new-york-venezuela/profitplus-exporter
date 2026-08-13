# SP: pObtenerTablaSmallDateStrInt
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerTablaSmallDateStrInt]
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
CREATE PROCEDURE [pObtenerTablaSmallDateStrInt]
    (
      @sdCampoClave1 SMALLDATETIME ,
      @sColumna1 NVARCHAR(17) ,
      @sCampoClave2 NVARCHAR(17) ,
      @sColumna2 NVARCHAR(17) ,
      @iCampoClave3 INT = NULL ,
      @sColumna3 NVARCHAR(17) ,
      @iTipo INT ,
      @sTabla VARCHAR(30)
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(1200) ,
            @sParametro NVARCHAR(500) 
        SET @sParametro = N'@sdCampoClave11 smalldatetime, @sCampoClave22 nvarchar(17), @iCampoClave33 int' 

	-- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ',' + @sColumna3 + ' FROM  ' + @sTabla
                    + ' ORDER BY ' + @sColumna1 + ',' + @sColumna2 + ',' + @sColumna3

            END	
	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ',' + @sColumna3 + ' FROM  ' + @sTabla
                    + ' 
			WHERE (((' + @sColumna1 + ' < @sdCampoClave11) OR 
				  ((' + @sColumna1 + ' = @sdCampoClave11) AND (' + @sColumna2 + ' < @sCampoClave22) AND ('
                    + @sColumna3 + ' >= @iCampoClave33))))'
                    + --OR
--				  (('+@sColumna1+' = @sdCampoClave11) AND ('+@sColumna2+' = @sCampoClave22) AND ('+@sColumna3+' < @iCampoClave33))))and ('+@sColumna1+' = @sdCampoClave11)'+
                    'ORDER BY ' + @sColumna1 + ' DESC,' + @sColumna2 + ' DESC,' + @sColumna3 + ' DESC  '			

            END	
	-- Anterior o Igual
        IF @iTipo = 4 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' +
```
