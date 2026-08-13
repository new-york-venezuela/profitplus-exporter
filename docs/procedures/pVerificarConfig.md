# SP: pVerificarConfig
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pVerificarConfig]
*DESCRIPCIÓN	: Verifica si el usuario o el mapa tiene una serie asignada
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [pVerificarConfig]
    (
      @sUsusario CHAR(6) ,
      @sMapa CHAR(6) ,
      @sTabla VARCHAR(32)
    )
AS 
    BEGIN
        DECLARE @Ncontrol VARCHAR(20)
        DECLARE @Serie VARCHAR(20)

        SET @Ncontrol = NULL
        SET @Serie = NULL

--select * from saarticulo
        DECLARE @Consulta VARCHAR(MAX)


        SET @Consulta = ' declare @Ncontrol varchar(20) ' + ' declare @Serie varchar(20) ' + ' set @Ncontrol = null '
            + ' set @Serie  = null ' + ' if exists(select co_config from ' + @sTabla + ' where co_usuario = '''
            + @sUsusario + ''')' + ' begin '
            + '    set @Ncontrol = (SELECT contr.C.value(''@Valor_Defecto'', ''Varchar(20)'') as Ncontrol'
            + '                    FROM ' + @sTabla
            + '                    CROSS APPLY xml_reglas.nodes(''/Reglas/Adicional/IfCombo/ifcNroControl'') contr(c)	 '
            + '                    WHERE co_usuario = ''' + @sUsusario + ''') '
            + '    set @Serie = (SELECT contr.C.value(''@Valor_Defecto'', ''Varchar(20)'')as Serie '
            + '                FROM ' + @sTabla
            + '                CROSS APPLY xml_reglas.nodes(''/Reglas/Adicional/IfCombo/ifcSerie'') contr(c)	 '
            + '                WHERE co_usuario = ''' + @sUsusario + ''') ' + ' end ' + ' else ' + ' begin  '
            + '    if exists(select co_config from ' + @sTabla + '  where co_mapa = ''' + @sMapa + ''') ' + '    begin '
            + '        set @Ncontrol = (SELECT contr.C.value(''@Valor_Defecto'', ''Varchar(10)'') '
            + '                        FROM ' + @sTabla
            + '                        CROSS APPLY xml_reglas.nodes(''/Reglas/Adicional/IfCombo/ifcNroControl'') contr(c)	 '
            + '                        WHERE co_mapa = ''' + @sMapa + ''') '
            + '        set @Serie = (SELECT contr.C.value(''@Valor_Defecto'', ''Varchar(10)'') '
            + '                        FROM ' + @sTabla
            + '                        CROSS APPLY xml_reglas.nodes(''/Reglas/Adicional/IfCombo/ifcSerie'') contr(c)	 '
            + '                        WHERE co_mapa = ''' + @sMapa + ''') ' + '
```
