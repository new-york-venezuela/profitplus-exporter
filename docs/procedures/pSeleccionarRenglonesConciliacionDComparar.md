# SP: pSeleccionarRenglonesConciliacionDComparar
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesConciliacionD
DESCRIPCION: Procedimiento para seleccionar los reglones de los detalles de conciliacion de la tabla saConciliacionDetalle
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
Create PROCEDURE [pSeleccionarRenglonesConciliacionDComparar]
    (
      @sCod_cta CHAR(6) ,
      @iMesArchivo int,
       @iAnoArchivo int
      
      
    )
AS 
    BEGIN

        SELECT
            Cd.Reng_num, Cd.co_auto_con, Cd.fec_mov, Cd.tipo_op, Cd.doc_num, Cd.descrip,Cd.monto_d, Cd.monto_h, Cd.idb, Cd.dep_con, Cd.origen, Cd.co_us_in,
            Cd.co_sucu_in, Cd.fe_us_in, Cd.co_us_mo, Cd.co_sucu_mo, Cd.fe_us_mo, Cd.revisado, Cd.trasnfe
        FROM
           saConciliacionAutoReng Ar 
           inner join saConciliacionDetalle Cd on Cd.co_auto_con=Ar.co_auto_con
           
        WHERE
            Ar.cod_cta =@sCod_cta
            and Ar.mesArchivo=@iMesArchivo
            and Ar.anoArchivo=@iAnoArchivo
             order by Cd.co_auto_con

    END
```
