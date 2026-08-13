# SP: pObtenerStatusTransferencia
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saTransferenciaEntreCuentas`](../tables/saTransferenciaEntreCuentas.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerStatusTransferencia]
DESCRIPCION: Obtener campo procesado de saTransferenciaEntreCuentas
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].pObtenerStatusTransferencia
    (
      @sCo_Trans CHAR(20)
    )
AS 
    BEGIN	

        SELECT
            procesado
        FROM
            dbo.saTransferenciaEntreCuentas
        WHERE
            co_trans_ban = @sCo_Trans
	
    END
```
