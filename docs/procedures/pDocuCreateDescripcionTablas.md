# SP: pDocuCreateDescripcionTablas
**Tipo**: Procedimiento
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			[pDocuCreateDescripcionTablas]
DESCRIPCION:	Crea el campo extendido descripcion en las tablas que no la posean
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/

CREATE PROCEDURE [pDocuCreateDescripcionTablas]
AS 
    BEGIN

        DECLARE campos_cursor CURSOR LOCAL FORWARD_ONLY
        FOR
            SELECT
                O.name, O.object_id
            FROM
                sys.objects O
            WHERE
                O.type = 'U'
                AND ( O.name LIKE 'sa%'
                      OR O.name LIKE 'sn%'
                      OR O.name LIKE 'sc%'
                    )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    sys.extended_properties P
                                 WHERE
                                    O.object_id = P.major_id
                                    AND p.name = 'descripcion' )

        DECLARE @Tabla_Name AS VARCHAR(64)
        DECLARE @Tabla_id AS INT
        DECLARE @Comando AS NVARCHAR(1024)

        OPEN campos_cursor
        FETCH NEXT FROM campos_cursor INTO @Tabla_Name, @Tabla_id

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @Comando = 'EXEC sp_addextendedproperty  
		@name = N''descripcion''
		,@value = ''' + @Tabla_Name + '''
		,@level0type = N''Schema'', @level0name = dbo
		,@level1type = N''Table'',  @level1name = ' + @Tabla_Name + ';'
                EXEC sp_executesql @Comando

                FETCH NEXT FROM campos_cursor INTO @Tabla_Name, @Tabla_id
            END
        CLOSE campos_cursor
        DEALLOCATE campos_cursor

    END
```
