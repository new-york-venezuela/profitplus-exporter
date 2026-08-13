# SP: pSeleccionarPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarArticulo
DESCRIPCION: Selecciona un pago
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarPago] ( @sCob_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            pg.*, pv.co_tab, pv.co_cta_ingr_egr, pv.desc_ppago AS descProntoPago
        FROM
            saPago pg
            INNER JOIN saProveedor pv ON pg.co_prov = pv.co_prov
        WHERE
            cob_num = @sCob_Num
    END
```
