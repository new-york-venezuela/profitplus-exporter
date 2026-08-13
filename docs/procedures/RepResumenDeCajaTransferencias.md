# SP: RepResumenDeCajaTransferencias
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoBancoExt`](../tables/pvMovimientoBancoExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepMovimientoCajaNumeroTurno
DESCRIPCION: Reporte de Movimientos de Caja por Turno
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[RepResumenDeCajaTransferencias]
    @sNum_Turno_d CHAR(20) = NULL ,
    @sNum_Turno_h CHAR(20) = NULL ,    
    @dFecha_d  smalldatetime = null,	
    @dFecha_h  smalldatetime = null,
    @sCo_Caja_d CHAR(6) = NULL ,
    @sCo_Caja_h CHAR(6) = NULL ,
    @sStatus char(2) = null,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0	

AS 
    BEGIN   
    
    SET NOCOUNT ON;
    
		 SELECT
		 pv.num_turno, De.tipo_op as forma_pag,
		 (case   when pv.status = 'N' then 'No Usado' when pv.status = 'C' then 'Cerrado' when pv.status = 'E' then 'En Espera' when pv.status = 'A' then 'Activo' end) as status,
		 tu.co_turno, tu.des_turno,  ca.cod_caja, 
		 DE.doc_num, De.fecha,De.co_cta_ingr_egr,
		 case when de.anulado = 0 then De.monto_d * -1	else 0.00 end as monto_d,
		 case when de.anulado = 0 then De.monto_h		else 0.00 end as monto_h,
		 De.mov_num, De.descrip, 
		 pv.fecha_ini, pv.fecha_fin, pv.user_caj, pv.user_sup,
		 case when de.anulado = 0 then (case when De.monto_h = 0 then  De.monto_d  else De.monto_h end) else 0.00 end as monto,
		 case when de.anulado = 1 then 'Anulado' else '' end as anulado,
		 De.origen, De.cod_cta, cb.num_cta, De.cob_pag cobro, Cb.co_mone, Mon.mone_des, Mon.cambio--Jortiz se agrego el campo co_mone, mone_des y cambio para mostrar el tipo de moneda en el reporte
  FROM   pvturnoexe as pv
	 INNER JOIN saCaja				 as ca on ca.cod_caja = pv.cod_caja  
	 INNER JOIN pvTurno				 as tu on tu.co_turno = pv.co_turno 
	 INNER JOIN pvMovimientoBancoExt  as fa on fa.rowguid_num_turno = pv.rowguid 
	 INNER JOIN saMovimientoBanco	 as De on De.rowguid = fa.rowguid_mov_num
	 INNER JOIN saCuentaBancaria as cb on cb.cod_cta = De.cod_cta
	 INNER JOIN saMoneda              as Mon on Mon.co_mone = cb.co_mone -- Jortiz
     WHERE   
            (@sNum_turno_d IS NULL OR @sNum_turno_d <= pv.num_turno)
		AND (@sNum_turno_h IS NULL OR pv.num_turno <= @sNum_turno_h)	
		AND (@sCo_caja_d IS NULL   OR @sCo_caja_d <= ca.cod_caja)
		AND (@sCo_caja_h IS NULL   OR ca.cod_caja <= @sCo_caja_h) 		       
        AND (@dFe
```
