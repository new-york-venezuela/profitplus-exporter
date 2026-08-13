# SP: pSeleccionarReglaIntGenerarDLL
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saReglaInt`](../tables/saReglaInt.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarReglaIntGenerarDLL
DESCRIPCION	: Seleccionar las Reglas de Integración para Generar la DLL
CREADO POR	: SOFTECH SISTEMAS
CREADO EL	: 09/03/2010
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarReglaIntGenerarDLL]
    (
      @sCo_reg CHAR(10) = NULL ,
      @sTipoDocumentos CHAR(600) = NULL
	
    )
AS 
    BEGIN
	
        IF ( @sTipoDocumentos IS NOT NULL
             AND @sTipoDocumentos <> ''
           ) 
            BEGIN
                DECLARE @sSql VARCHAR(MAX)

                SET @sSql = 'SELECT r.co_reg, r.tipo, r.encabezado, r.aplica, r.monto, r.gasto, r.distri, r.descrip, r.cuenta
				FROM [dbo].[saReglaInt] R WHERE r.tipo IN (' + @sTipoDocumentos + ')'  
                IF ( @sCo_reg IS NOT NULL ) 
                    SET @sSql = @sSql + 'AND (r.co_reg =' + @sCo_reg + ')'
                ELSE 
                    SET @sSql = @sSql + ' AND r.inactivo = 0'
			
                SET @sSql = @sSql + ' ORDER BY r.co_reg'

                EXEC(@sSql)
		
            END 
        ELSE 
            SELECT
                r.co_reg, r.tipo, r.encabezado, r.aplica, r.monto, r.gasto, r.distri, r.descrip, r.cuenta
            FROM
                [dbo].[saReglaInt] R
            WHERE
                r.co_reg = @sCo_reg
                OR ( @sCo_reg IS NULL
                     AND r.inactivo = 0
                   )
            ORDER BY
                r.co_reg
    END
```
