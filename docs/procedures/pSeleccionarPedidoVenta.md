# SP: pSeleccionarPedidoVenta
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pSeleccionarPedidoVenta
*DESCRIPCIÓN	: Selecciona un Pedido de venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pSeleccionarPedidoVenta] ( @sDoc_Num CHAR(20) )
AS 
    BEGIN

        SELECT
            v.*, c.sincredito, c.dir_ent2, c.plaz_pag, c.desc_glob, c.co_ven, c.tip_cli
        FROM
            saPedidoVenta v
            INNER JOIN saCliente c ON v.co_cli = c.co_cli
        WHERE
            doc_num = @sDoc_Num

    END
```
