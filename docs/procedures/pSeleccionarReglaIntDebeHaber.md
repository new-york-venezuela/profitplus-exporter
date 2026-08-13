# SP: pSeleccionarReglaIntDebeHaber
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarReglaIntDebeHaber
DESCRIPCION	: Seleccionar las Reglas de Integración con su debehaber
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 18/03/2010
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarReglaIntDebeHaber]
    (
      @sTipoDocumentos CHAR(600)
    )
AS 
    BEGIN
	
        DECLARE @sSql VARCHAR(MAX)

        SET @sSql = 'SELECT R.tipo, R.co_reg, R.debehaber
			FROM [saReglaInt] R WHERE r.inactivo = 0 AND R.tipo IN (' + @sTipoDocumentos
            + ') ORDER BY R.co_reg ASC'

        EXEC(@sSql)
	
    END
```
