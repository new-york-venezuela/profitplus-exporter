# SP: pvRepDetallesFormaPagoTurno
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvCobroExt`](../tables/pvCobroExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
/****************************************************************************
*NOMBRE			: pvRepDetallesFormaPagoTurno
*DESCRIPCIÓN	: Reporte de detalles de Forma de Pago Turno Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
*****************************************************************************/ 

CREATE PROCEDURE [dbo].[pvRepDetallesFormaPagoTurno]
    @sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = null, 
    @sCod_caja_d char(6) = null,
    @sCod_caja_h char(6) = null,
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null,
    @sStatus char(2) = null
	--@sCo_Sucursal CHAR(6) = NULL ,
    --@sCampOrderBy VARCHAR(16) = NULL ,
    --@sDir VARCHAR(6) = NULL ,
    --@bHeaderRep BIT = 0
AS 
    BEGIN    
		SELECT
			pv.num_turno, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' 
			when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status ,
			pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin,
			pv.user_caj, pv.user_sup, De.cob_num, De.fecha, dr.nro_doc, ct.mov_num_c, ct.forma_pag,
			ct.mont_doc, mc.descrip, tc.co_tar, tc.des_tar

		FROM pvturnoexe as pv
			 inner join saCaja as ca on ca.cod_caja = pv.cod_caja  
			 inner join pvTurno as tu on tu.co_turno = pv.co_turno 
			 inner join pvCobroExt as fa on fa.rowguid_num_turno = pv.rowguid 
			 inner join saCobro as De on De.rowguid = fa.rowguid_cob_num 
			 inner join saCobroDocReng as dr on dr.cob_num = De.cob_num 
			 inner join saCobroTPReng as ct on ct.cob_num = de.cob_num 
			 inner join saMovimientoCaja as mc on mc.cod_caja = ca.cod_caja 
			 left join saTarjetaCredito as tc on tc.co_tar = ct.co_tar
		WHERE 
				(@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
			AND (@sNum_turno_h IS NULL OR pv.num_turno <= @sNum_turno_h) 
			AND (@sCod_caja_d IS NULL  OR @sCod_caja_d <= pv.cod_caja)
			AND (@sCod_caja_h IS NULL  OR pv.cod_caja  <= @sCod_caja_h) 
			AND (@dFecha_d IS NULL     OR  dbo.FechaSimple(pv.fecha_ini) >= @dFecha_d)
			AND ( @dFecha_h IS NULL    OR  dbo.FechaSimple(pv.fecha_fin) <= @dFecha_h)
			AND (pv.status = @sStatus  OR @sStatus IS NULL )
                              
		-- group by  pv.num_turno , pv.status, pv.cod_caja, ca.descrip,pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, De.cob_num, De.fecha, dr.nro_doc, ct.forma_pag, ct.mov_num_c, ct.mont_doc, mc.descrip, tc.co_ta
```
