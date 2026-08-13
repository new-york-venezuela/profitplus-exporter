# SP: pObtenerTablaStrDocumento
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerTablaStrDocumento
DESCRIPCION: Busca el primer, siguiente, anterior, ultimo registro de una tabla cuya clave primaria esta conforme
			por dos campos.
			@sCampoClave1 representa el valor del campo base en formato texto.
			@sColumna1 nombre de la columna para hacer la busqueda, clave primaria
			@sCampoClave2 representa el valor del campo secundario en de texto.
			@sColumna2 nombre de la columna para hacer la busqueda, clave secundaria
			@iTipo 0 - Primero, 1 - Anterior, 2 - Siguiente, 3 - Ultimo
			@sTabla Nombre de la tabla
			@iContexto 0 - Importacion
			@bIgnorarStatus 1 - Ignorar el Status del documento
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerTablaStrDocumento]
    (
      @sCampoClave1 VARCHAR(20) = NULL ,
      @sColumna1 VARCHAR(20) ,
      @sCampoClave2 VARCHAR(20) = NULL ,
      @sColumna2 VARCHAR(20) ,
      @iTipo INT ,
      @sTabla VARCHAR(40) ,
      @iContexto INT ,
      @bIgnorarStatus BIT
	
    )
AS 
    BEGIN	
        DECLARE
            @sSql NVARCHAR(1500) ,
            @sParametro NVARCHAR(500) ,
            @sContexto NVARCHAR(100)
        SET @sParametro = N'@sCampoClave varchar(20)' 
        SET @sContexto = CASE WHEN @iContexto = 0
                                   AND @sCampoClave2 IS NOT NULL
                              THEN N' (' + @sColumna2 + ' = ''' + @sCampoClave2 + ''' '
                              ELSE N' (1=1'
                         END
	
        SET @sContexto = @sContexto + CASE @bIgnorarStatus
                                        WHEN 1 THEN ') '
                                        ELSE ' AND anulado = 0 AND status <> 2) '
                                      END
	
	-- Primero
        IF @iTipo = 0 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ', ' + @sColumna2 + ' FROM dbo.' + @sTabla + ' WHERE '
                    + @sContexto + ' ORDER BY ' + @sColumna1   
            END	

	-- Anterior
        IF @iTipo = 1 
            BEGIN
                SET @sSql = 'SELECT TOP (1) ' + @sColumna1 + ', ' + @sColumna2 + ' FROM dbo.' + @sTabla + ' WHERE ('
                    + @sColumna1 + ' < @sCampoClave) AND ' + @sContexto + ' ORDER BY ' + @sColumna1 + ' DESC'
```
