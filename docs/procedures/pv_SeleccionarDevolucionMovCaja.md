# SP: pv_SeleccionarDevolucionMovCaja
**Tipo**: Punto de Venta
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: PV_SeleccionarDevolucionMovCaja
DESCRIPCION: Selecciona un registro de la tabla saDevolucionCliente segun el número de devolución.
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pv_SeleccionarDevolucionMovCaja]
    (
      @sNro_Doc CHAR(20)
    )
AS 
    BEGIN

       SELECT
        c.*, mc.monto_d, mc.mov_num, mc.cod_caja as cod_caja_dev
    FROM
              saCobroTpReng c INNER JOIN 
              saMovimientoCaja mc on c.cob_num = mc.doc_num
    WHERE
                     c.cob_num = @sNro_Doc and mc.origen = 'COB'
       END
```
