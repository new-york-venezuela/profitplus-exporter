# SP: pSeleccionarCotizacionCliente
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarCotizacionCliente
*DESCRIPCIÓN	: Selecciona una cotizacion de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pSeleccionarCotizacionCliente] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            v.*, c.sincredito, c.dir_ent2, c.plaz_pag, c.desc_glob, c.co_ven, c.tip_cli
        FROM
            saCotizacionCliente v
            INNER JOIN saCliente c ON v.co_cli = c.co_cli
        WHERE
            doc_num = @sDoc_Num

    END
```
