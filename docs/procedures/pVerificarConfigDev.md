# SP: pVerificarConfigDev
**Tipo**: Procedimiento
**Módulo**: General

## Tablas Referenciadas
- [`saConfigDevolucionCliente`](../tables/saConfigDevolucionCliente.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pVerificarConfig]
*DESCRIPCIÓN	: Verifica si el usuario o el mapa tiene una serie asignada
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [pVerificarConfigDev]
    (
      @sUsusario CHAR(6) ,
      @sMapa CHAR(6)
    )
AS 
    BEGIN
        DECLARE @Ncontrol VARCHAR(20)
        DECLARE @Serie VARCHAR(20)

        IF EXISTS ( SELECT
                        co_config
                    FROM
                        saConfigDevolucionCliente
                    WHERE
                        co_usuario = @sUsusario ) 
            BEGIN
                SET @Serie = ( SELECT
                                contr.C.value('@Valor_Defecto', 'Varchar(20)') AS serie
                               FROM
                                saConfigDevolucionCliente
                                CROSS APPLY xml_reglas.nodes('/Reglas/Adicional/IfCombo/texNCR') contr ( c )
                               WHERE
                                co_usuario = @sUsusario
                             )

                SET @Ncontrol = ( SELECT
                                    contr.C.value('@Valor_Defecto', 'Varchar(20)') AS Ncontrol
                                  FROM
                                    saConfigDevolucionCliente
                                    CROSS APPLY xml_reglas.nodes('/Reglas/Adicional/IfCombo/ifcNroControl') contr ( c )
                                  WHERE
                                    co_usuario = @sUsusario
                                )
            END
        SELECT
            @Serie AS Serie, @Ncontrol AS Ncontrol
    END
```
