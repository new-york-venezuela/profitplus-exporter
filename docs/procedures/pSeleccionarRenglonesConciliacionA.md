# SP: pSeleccionarRenglonesConciliacionA
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesConciliacionA
DESCRIPCION: Procedimiento para seleccionar los reglones de conciliacion automática
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesConciliacionA] ( @sCod_Cta CHAR(6) )
AS 
    BEGIN
        SELECT
            0 AS reng_num, cod_cta, mesArchivo, anoArchivo, co_auto_con, fecImpor, status, archivo, tamanoPaquete,
            totalMov, totalCon, totalRep, saldoEc, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
            revisado, trasnfe, rowguid
        FROM
            saConciliacionAutoReng
        WHERE
            cod_cta = @sCod_Cta
    END
```
