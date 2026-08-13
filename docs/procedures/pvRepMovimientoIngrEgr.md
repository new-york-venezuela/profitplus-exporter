# SP: pvRepMovimientoIngrEgr
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvRepMovimientoIngrEgr
*DESCRIPCIÓN	: Reporte de Movimientos de Ingreso y Egreso
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pvRepMovimientoIngrEgr]
          
    @sNum_Turno_d CHAR(20) = NULL ,
    @sNum_Turno_h CHAR(20) = NULL ,    
    @dFecha_d  smalldatetime = NULL,	
    @dFecha_h  smalldatetime = NULL
AS 
    BEGIN
		 SELECT
			pv.num_turno, De.forma_pag,
			(case   when pv.status = 'N' then 'No Usado' when pv.status = 'C' then 'Cerrado' when pv.status = 'E' 
			then 'En Espera' when pv.status = 'A' then 'Activo' end) as status, 
			tu.co_turno, tu.des_turno,  ca.cod_caja, De.doc_num, De.fecha,De.co_cta_ingr_egr,(De.monto_d*-1) as monto_d,
			De.monto_h,De.mov_num, De.descrip, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup,
			(case when De.monto_h = '0' then  De.monto_d  when De.monto_d='0' then De.monto_h end) as monto 		
		  
		 FROM         
			pvturnoexe as pv
			inner join saCaja as ca on ca.cod_caja = pv.cod_caja
			inner join pvTurno as tu on tu.co_turno = pv.co_turno
			inner join pvMovimientoCajaExt as fa on fa.rowguid_num_turno = pv.rowguid
			left join saMovimientoCaja as De on De.rowguid = fa.rowguid_mov_num          
		  WHERE
				((@sNum_turno_d IS NULL   OR @sNum_turno_d <= pv.num_turno)
				AND ( @sNum_turno_h IS NULL  OR pv.num_turno <= @sNum_turno_h ))
				--AND ((@sCo_caja_d IS NULL  OR @sCo_caja_d <=ca.cod_caja)
				--AND ( @sCo_caja_h IS NULL OR ca.cod_caja  <= @sCo_caja_h))
				AND ( ( @dFecha_d IS NULL
						OR  dbo.FechaSimple(pv.fecha_ini) >= @dFecha_d
					   )
				AND ( @dFecha_h IS NULL
						OR  dbo.FechaSimple(pv.fecha_fin) <= @dFecha_h
					   )
					 )
				--AND (@sStatus is null   or pv.status = @sStatus )        
		 GROUP BY
			pv.num_turno, De.forma_pag, pv.status,tu.co_turno, tu.des_turno,ca.cod_caja, 
			De.doc_num, De.fecha,De.co_cta_ingr_egr,De.monto_d,De.monto_h,
			De.mov_num, De.descrip, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup,
			De.monto_d
    END
```
