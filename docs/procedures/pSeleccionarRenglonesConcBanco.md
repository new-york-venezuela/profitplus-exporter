# SP: pSeleccionarRenglonesConcBanco
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConcBanco`](../tables/saConcBanco.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarRenglonesConcBanco
DESCRIPCION: Procedimiento para seleccionar los reglones de la tabla saConcBanco
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesConcBanco]
    (
      @sCod_Cta CHAR(6) ,
      @sCo_Auto_con CHAR(6) ,
      @sMov_Num CHAR(20) = NULL ,
      @bCon_auto BIT
	
    )
AS 
    BEGIN    
        SELECT
            cb.co_auto_con, reng_num, cb.mov_num, cb.fec_conc, cb.con_auto, cb.co_us_in, cb.co_sucu_in, cb.fe_us_in, cb.co_us_mo, cb.co_sucu_mo,
            cb.fe_us_mo, cb.revisado, cb.trasnfe, cb.rowguid,mb.monto_h,mb.monto_h
        FROM
            saConcBanco cb 
            inner join samovimientoBanco mb on mb.mov_num=cb.mov_num
        WHERE
            cb.mov_num = @sMov_Num
            OR @sMov_Num IS NULL
            AND cb.con_auto = @bCon_auto
            AND cb.co_auto_con = @sCo_Auto_con
    END
```
