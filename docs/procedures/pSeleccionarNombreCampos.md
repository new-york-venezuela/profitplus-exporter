# SP: pSeleccionarNombreCampos
**Tipo**: Seleccionar
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pSeleccionarNombreCampos]
*DESCRIPCIÓN	: Seleccciona Los nombre de los campos de una tabla determinada
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-04-12
**************************************************************************/

CREATE PROCEDURE [pSeleccionarNombreCampos] ( @sTabla CHAR(30) )
AS 
    BEGIN
        SELECT
            sys.columns.object_id, sys.columns.name, sys.columns.column_id, sys.columns.system_type_id,
            sys.types.name AS TYPE_NAME
        FROM
            sys.columns
            INNER JOIN sys.types ON sys.columns.system_type_id = sys.types.system_type_id
        WHERE
            object_id IN ( SELECT
                            object_id
                           FROM
                            sys.objects
                           WHERE
                            (type = 'V' or type='U')
                            AND name = @sTabla )
            AND sys.columns.name <> 'validador'
            AND sys.columns.name <> 'trasnfe'
            AND sys.columns.name <> 'rowguid'
            AND sys.columns.name <> 'revisado'
        ORDER BY
            name
    END
```
