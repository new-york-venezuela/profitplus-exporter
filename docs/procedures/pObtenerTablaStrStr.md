# SP: pObtenerTablaStrStr
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerTablaStrStr
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
CREATE PROCEDURE [pObtenerTablaStrStr]
    (
      @sCampoClave1 VARCHAR(20) = NULL ,
      @sColumna1 VARCHAR(20) ,
      @sCampoClave2 VARCHAR(20) = NULL ,
      @sColumna2 VARCHAR(20) ,
      @iTipo INT ,
      @sTabla VARCHAR(50)
    )
AS 
    BEGIN    
        DECLARE
            @sSql NVARCHAR(1200) ,
            @sParametro NVARCHAR(500) 
        SET @sParametro = N'@sCampoClave11 varchar(20), @sCampoClave22 varchar(20)' 
             
       -- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla + ' ORDER BY '
                    + @sColumna1 + ',' + @sColumna2
            END     

       -- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE ('
                    + @sColumna1 + ' < @sCampoClave11) OR ((' + @sColumna1 + ' = @sCampoClave11) AND (' + @sColumna2
                    + ' < @sCampoClave22)) ORDER BY ' + @sColumna1 + ' DESC,' + @sColumna2 + ' DESC '
            END     

       -- Anterior o Igual
        IF @iTipo = 4 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColumna2 + ' FROM  ' + @sTabla + ' WHERE 
                                  ((' + @sColumna1 + ' = @sCampoClave11) AND (' + @sColumna2
                    + ' < @sCampoClave22)) ORDER BY ' + @sColumna1 + ' DESC,' + @sColumna2 + ' DESC '
            END     

       -- Siguiente
        IF @iTipo = 2 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ',' + @sColu
```
