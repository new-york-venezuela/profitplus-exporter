# SP: pv_ObtenerMovCajaXTurno
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
--Author:	SOFTECH SISTEMAS
--Create date:	
--Last update:	2017-07-04
--Descripction: BUSCA LOS MOVIMIENTOS DE CAJA DEL TURNO DADO 
***************************************************************************/
 
CREATE PROCEDURE [dbo].[pv_ObtenerMovCajaXTurno]
(
	@num_turno	CHAR(20),
	@user		CHAR(6),
	@caja		CHAR(6)
)
AS
SET NOCOUNT ON
BEGIN
	SELECT MC.rowguid, MC.validador,
		MC.mov_num, MC.forma_pag,
		MC.doc_num, 
		case when MC.monto_h > 0 
			then MC.monto_h 
			else MC.monto_d * -1 end as monto_h,
		MC.descrip, MC.num_pago,
		MC.co_ban, MC.co_tar, MC.Co_vale,
		TE.co_turno, TE.fecha_ini AS inicio
			FROM saMovimientoCaja MC
			Inner Join pvMovimientoCajaExt MCEXT on MC.rowguid = MCEXT.rowguid_mov_num
			Inner Join pvTurnoExe TE On MCEXT.rowguid_num_turno = TE.rowguid
				WHERE MC.cod_caja = @caja
					AND MC.anulado = 0
					AND MC.transferido = 0 
					AND MC.depositado = 0
					AND MC.origen  <>  'TRA'
					AND ((MC.monto_h > 0 AND MC.forma_pag <> 'EF')
						OR  MC.forma_pag = 'EF')
					
END
```
