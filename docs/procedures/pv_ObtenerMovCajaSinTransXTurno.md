# SP: pv_ObtenerMovCajaSinTransXTurno
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerMovCajaSinTransXTurno
*DESCRIPCIÓN	: OBTIENE LOS MOVIMIENTOS DE CAJA SIN TRANSFERIR DE UN TURNO DADO
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE  [dbo].[pv_ObtenerMovCajaSinTransXTurno]
(
	@sNumTurno CHAR(20)
) 

AS 
BEGIN
	SELECT	movCaja.mov_num FROM saMovimientoCaja movCaja INNER JOIN 
			pvMovimientoCajaExt movCajaExt ON movCajaExt.rowguid_mov_num = movCaja.rowguid  INNER JOIN
			pvTurnoExe turnoExe ON turnoExe.rowguid = movCajaExt.rowguid_num_turno AND turnoExe.num_turno = @sNumTurno
	WHERE	movCaja.anulado = 0 AND movCaja.transferido = 0 AND movCaja.origen <> 'TRA'
END
```
