# SP: pSeleccionarConcBancaria
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConcBanco`](../tables/saConcBanco.md)
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)
- [`saConciliacionDetalle`](../tables/saConciliacionDetalle.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			:	pSeleccionarConcBancaria
*FECHA CREACIÓN :   <2011-12-12>
*FECHA MODIFICACIÓN:<2020-01-13>
*DESCRIPCION	:	Selecciona todos los registros de la tabla  saMovimientoBanco
*CREADO			:	SOFTECH SISTEMAS
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarConcBancaria] ( @sCod_Cta CHAR(6), @iAnho int, @iMes int)
AS 
    BEGIN
                                    
        SELECT      DISTINCT
            mb.mov_num, mb.descrip, mb.cod_cta AS Codigo, mb.co_cta_ingr_egr, mb.fecha, mb.tasa, mb.tipo_op, mb.doc_num,
            mb.idb, mb.saldo_ini, mb.origen, mb.cob_pag, mb.dep_num,ISNULL(mb.conciliado, 0) as conciliado, mb.ori_dep, mb.anulado, mb.dep_con,
            mb.fec_con, mb.cod_ingben, mb.fecha_che, mb.feccom, mb.numcom, mb.campo1, mb.campo2,
            mb.campo3, mb.campo4, mb.campo5, mb.campo6, mb.campo7, mb.campo8, mb.co_us_in, mb.co_sucu_in, mb.fe_us_in,
            mb.co_us_mo, mb.co_sucu_mo, mb.fe_us_mo, mb.trasnfe, mb.revisado, mb.validador, mb.rowguid,
            CASE WHEN Tipo_Op IN ( 'CH', 'ND', 'RC', 'TR' ) THEN monto_d
					WHEN Tipo_Op IN ('ID') THEN idb
                 ELSE monto_h
            END AS monto, ISNULL(cb.con_auto, 0) con_auto, MONTH(mb.fecha) Mes, YEAR(mb.fecha) Anho,MONTH(mb.fec_con) MesM, YEAR(mb.fec_con) AnhoM, cb.co_auto_con
        FROM
            saMovimientoBanco mb
            LEFT  JOIN saConcBanco cb ON mb.mov_num = cb.mov_num
        WHERE
            anulado = 0
            AND cod_cta = @sCod_Cta
                    AND (
                                  ( mb.conciliado = 1 and year(mb.fec_con) = @iAnho and month(mb.fec_con) = @iMes)
                           OR     ( mb.conciliado = 0 and ((year(mb.fecha) = @iAnho and month(mb.fecha) <= @iMes) or year(mb.fecha) < @iAnho))
                           )
        ORDER BY
            mb.fecha DESC
       
        SELECT DISTINCT
            cd.reng_num, cd.co_auto_con, cd.fec_mov, cd.doc_num, cd.tipo_op, cd.descrip, cd.monto_d, cd.monto_h, cd.idb,
            cd.origen, cd.dep_con, cd.repetido, cd.co_us_in, cd.co_sucu_in, cd.fe_us_in, cd.co_us_mo, cd.co_sucu_mo,
            cd.fe_us_mo, cd.rowguid, cb.con_auto, ca.mesArchivo, ca.anoArchivo,
           ISNULL(mb.conciliado, 0) as conciliado, ca.cod_cta
        FROM
            saConciliaci
```
