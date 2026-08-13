# SP: pSeleccionarRenglonesConciliacionD
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesConciliacionD
DESCRIPCION: Procedimiento para seleccionar los reglones de los detalles de conciliacion de la tabla saConciliacionDetalle
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesConciliacionD]
    (
      @sStatus CHAR(3) = NULL ,
      @sCo_Auto_Con CHAR(6)
    )
AS 
    BEGIN

        SELECT
            Reng_num, co_auto_con, fec_mov, tipo_op, doc_num, descrip, monto_d, monto_h, idb, dep_con, origen, co_us_in,
            co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe
        FROM
            saConciliacionDetalle
        WHERE
            co_auto_con = @sCo_Auto_Con
            OR @sCo_Auto_Con IS NULL

    END
```
