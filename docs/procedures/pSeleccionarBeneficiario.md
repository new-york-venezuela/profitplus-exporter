# SP: pSeleccionarBeneficiario
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarColor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarBeneficiario] ( @sCod_Ben CHAR(10) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saBeneficiario
        WHERE
            cod_ben = @sCod_Ben
    END
```
