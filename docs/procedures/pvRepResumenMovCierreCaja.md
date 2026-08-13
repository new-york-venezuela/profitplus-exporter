# SP: pvRepResumenMovCierreCaja
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
/***************************************************************************
*NOMBRE			: pvRepResumenMovCierreCaja
*DESCRIPCIÓN	: Reporte del Resumen Mov. Cierre de Caja de Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
****************************************************************************/ 
CREATE PROCEDURE [dbo].[pvRepResumenMovCierreCaja]
	@sNum_turno_d char(20) = null, 
    @sNum_turno_h char(20) = NULL, 
    @sCod_caja_d char(6) = null,
    @sCod_caja_h char(6) = null,
    @dFecha_d smalldatetime = null,
    @dFecha_h smalldatetime = null,
    @sStatus char(2) = null,
    @dMonto_caja Decimal (18,2) = NULL,
    @dStock decimal(18,5) = NULL,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN    
		 SELECT 
			PV.NUM_TURNO, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status ,
			pv.cod_caja, ca.descrip as des_caja,  pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, 
			isnull(sum(case when mc.forma_pag = 'EF' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) as efectivoIng,
			isnull(sum(case when mc.forma_pag = 'EF' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else 0 end),0) as efectivoIngN,
			isnull(sum(case when mc.forma_pag = 'CH' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) as chequesIng,
			isnull(sum(case when mc.forma_pag = 'CH' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else 0 end),0) as chequesIngN,
			isnull(sum(case when mc.forma_pag = 'TJ' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) as TarjetasIng,
			isnull(sum(case when mc.forma_pag = 'TJ' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else 0 end),0) as TarjetasIngN,
			isnull(sum(case when mc.forma_pag = 'CT' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) as ValeIng,
			isnull(sum(case when mc.forma_pag = 'CT' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else 0 end),0) as ValeIngN,
			isnull(sum(case when mc.forma_pag = 'EF' and mc.origen ='TRA' and mc.tipo_mov = 'E' then mc.monto_d * -1 else 0.00 end),0.00) as efectivoEgr,
			isnull(sum(case when mc.forma_pag = 'EF' and mc.origen ='TRA' and mc.tipo_mov = 'E' then 1               e
```
