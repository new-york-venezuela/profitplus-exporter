# SP: pSeleccionarDescCampos
**Tipo**: Seleccionar
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pSeleccionarDescCampos]
*DESCRIPCIÓN	: Seleccciona la descripcion de los campos de una tabla determinada
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-04-13
**************************************************************************/

CREATE PROCEDURE [pSeleccionarDescCampos]
    (
      @sTabla CHAR(30) ,
      @iTblId INT ,
      @iColId INT
    )
AS 
    BEGIN
        SELECT DISTINCT
            SUBSTRING(CAST(sys.extended_properties.value AS VARCHAR(60)), 0,
                      CASE WHEN CHARINDEX('.', CAST(sys.extended_properties.value AS VARCHAR(60))) > 0
                           THEN CHARINDEX('.', CAST(sys.extended_properties.value AS VARCHAR(60)))
                           ELSE LEN(CAST(sys.extended_properties.value AS VARCHAR(60)))
                      END)
        FROM
            sys.columns ,
            sys.extended_properties
        WHERE
            OBJECT_ID IN ( SELECT
                            OBJECT_ID
                           FROM
                            sys.objects
                           WHERE
                            TYPE = 'V' or TYPE='U'
                            AND name = @sTabla )
            AND sys.extended_properties.major_id = @iTblId
            AND sys.extended_properties.minor_id = @iColId
    END
```
