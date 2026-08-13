# SP: pObtenerNroAjuste
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pObtenerNroAjuste]
*DESCRIPCIÓN	: obtiene el numero de ajuste de inventario a partir del codigo de inventario fisico asociado
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-05-25
*******************************************************************************************************************/

CREATE PROCEDURE [pObtenerNroAjuste]
    (
      @sCo_InvFisico CHAR(20)
    )
AS 
    BEGIN	

        SELECT
            ajue_num
        FROM
            saAjuste
        WHERE
            co_invfisico = @sCo_InvFisico

    END
```
