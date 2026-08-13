# SP: RepResumenMovCierreCajaPuntodeVenta
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`pvDevolucionClienteExt`](../tables/pvDevolucionClienteExt.md)
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepResumenMovCierreCajaPuntodeVenta
DESCRIPCION: Resumen Mov. Cierre de Caja de Punto de Venta
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepResumenMovCierreCajaPuntodeVenta]
	-- Add the parameters for the stored procedure here
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
    
    SET NOCOUNT ON;


select PV.NUM_TURNO, (case when pv.status = 'C' then 'Cerrado'  when pv.status = 'N' then 'No Usado' when pv.status = 'E' 

then 'En Espera' when pv.status = 'A' then 'Activo' end) as status ,


  CASE WHEN mc.cod_caja = ca.cod_caja   then
		 ca.cod_caja 
		 WHEN mc.cod_caja = ca2.cod_caja then 
		ca2.cod_caja
		 WHEN mc.cod_caja = ca3.cod_caja then 
		 ca3.cod_caja
   end 
		 as cod_caja
		
 ,
   CASE WHEN mc.cod_caja = ca.cod_caja   then
		ca.descrip
		 WHEN mc.cod_caja = ca2.cod_caja then 
		ca2.descrip
		 WHEN mc.cod_caja = ca3.cod_caja then 
		 ca3.descrip 
   end 
 as des_caja,   pv.co_turno, tu.des_turno, pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup, 
  isnull(sum(case when mc.forma_pag = 'EF' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) 

as efectivoIng,
  isnull(sum(case when mc.forma_pag = 'EF' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else 0 end),0) as 

efectivoIngN,
  isnull(sum(case when mc.forma_pag = 'CH' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) 

as chequesIng,
  isnull(sum(case when mc.forma_pag = 'CH' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else 0 end),0) as 

chequesIngN,
  isnull(sum(case when mc.forma_pag = 'TJ' and mc.origen ='COB' and mc.tipo_mov = 'I' then mc.monto_h else 0.00 end),0.00) 

as TarjetasIng,
  isnull(sum(case when mc.forma_pag = 'TJ' and mc.origen ='COB' and mc.tipo_mov = 'I' then 1          else
```
