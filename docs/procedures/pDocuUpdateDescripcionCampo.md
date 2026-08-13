# SP: pDocuUpdateDescripcionCampo
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pDocuUpdateDescripcionCampo
DESCRIPCION:	Actualiza en todas las tablas la descripcion de un campo
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [pDocuUpdateDescripcionCampo]
    @Campo AS CHAR(32) ,
    @Valor AS VARCHAR(2048)
AS 
    BEGIN

        DECLARE @iNuevos AS INT
        DECLARE @iViejos AS INT

        SET @iNuevos = 0
        SET @iViejos = 0

        DECLARE campos_cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                O.name AS tabla_name, C.name AS column_name, O.object_id, C.column_id
            FROM
                sys.columns C
                INNER JOIN sys.objects O ON O.object_id = C.object_id
            WHERE
                C.name = @Campo
                AND O.type = 'U'

        DECLARE @Tabla_Name AS VARCHAR(64)
        DECLARE @Column_Name AS VARCHAR(64)
        DECLARE @Tabla_id AS INT
        DECLARE @Column_id AS INT
        DECLARE @Comando AS NVARCHAR(2048)

        OPEN campos_cursor
        FETCH NEXT FROM campos_cursor INTO @Tabla_Name, @Column_Name, @Tabla_id, @Column_id

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                IF ( EXISTS ( SELECT
                                *
                              FROM
                                sys.extended_properties P
                              WHERE
                                @Column_id = P.minor_id
                                AND @Tabla_id = P.major_id ) ) 
                    BEGIN
                        SET @iViejos = @iViejos + 1
                        SET @Comando = 'EXEC sp_updateextendedproperty 
		@name = N''MS_Description''
		,@value = ''' + RTRIM(@Valor) + '''
		,@level0type = N''Schema'', @level0name = dbo
		,@level1type = N''Table'',  @level1name = ' + @Tabla_Name + ',@level2type = N''Column'', @level2name = '
                            + @Campo + ';'
                    END
                ELSE 
                    BEGIN
                        SET @iNuevos = @iNuevos + 1
                        SET @Comando = 'EXEC sp_addextendedproperty  
		@name = N''MS_Description''
		,@value = ''' + RTRIM(@Valor) + '''
		,@level0type = N''Schema'', @level0name = dbo
		,@level1type = N''Table'',  @level1name = ' + @Tab
```
