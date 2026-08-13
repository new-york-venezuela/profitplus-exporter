# SP: pObtenerTablaSmallDateStr
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerTablaSmallDateStr
DESCRIPCION: Busca el primer, siguiente, anterior, ultimo registro de una tabla cuya clave primaria esta conforme
			por dos campos partiendo de un PrimaryKey que pertenezca al padre.
			@sCampoClave1 representa el valor del primer campo de la clave.
			@sColumna1 nombre de la primera columna para hacer la busqueda, clave primaria
			@sCampoClave2 representa el valor del segundo campo de la clave.
			@sColumna2 nombre de la segunda columna para hacer la busqueda, clave primaria
			@iTipo 0 - Primero, 1 - Anterior, 2 - Siguiente, 3 - Ultimo
			@sTabla Nombre de la tabla
CREADO POR: SOFTECH SISTEMAS
FECHA :	20/05/2009
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerTablaSmallDateStr]
    (
      @sCampoClave1 NVARCHAR(17) ,
      @sColumna1 NVARCHAR(17) ,
      @sdCampoClave2 SMALLDATETIME ,
      @sColumna2 NVARCHAR(17) ,
      @iTipo INT ,
      @sTabla VARCHAR(30)
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(1200) ,
            @sParametro NVARCHAR(500) ,
            @sContienePk NVARCHAR(100)
        SET @sParametro = N'@sdCampoClave22 smalldatetime, @sCampoClave11 nvarchar(17)' 

	--Asigno una condicion solo si existe el Pk para realizarla
        SET @sContienePk = CASE @sCampoClave1
                             WHEN NULL THEN N' 1=1 '
                             ELSE N' (' + @sColumna1 + ' = ''' + @sCampoClave1 + ''') '
                           END

	-- Primero (contiene filtro condicional @sContienePk)
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna2 + ',' + @sColumna1 + ' FROM  ' + @sTabla + ' WHERE '
                    + @sContienePk + ' ORDER BY ' + @sColumna2 + ' ASC,' + @sColumna1 + ' ASC'
					
            END	
	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'IF EXISTS(SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla
                    + ' WHERE (' + @sColumna2 + ' < @sdCampoClave22) AND (' + @sColumna1
                    + ' = @sCampoClave11) ORDER BY ' + @sColumna2 + ' DESC,' + @sColumna1 + ' DESC )
						BEGIN
							SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla
                    + ' WHERE ((' + @sColum
```
