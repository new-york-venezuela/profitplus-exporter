# SP: pSeleccionarGiroCompra
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saGiroCompra`](../tables/saGiroCompra.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pSeleccionarGiroCompra
DESCRIPCION	: Selleciona un registro de la tabla saDepositoBanco segun su codigo
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarGiroCompra] ( @sCo_Giro CHAR(20) )
AS 
    BEGIN
        SELECT
            *
        FROM
            saGiroCompra
        WHERE
            co_giro = @sCo_Giro
    END
```
