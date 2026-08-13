# SP: pv_SeleccionarMovimientoCajaPvExt
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvMovimientoCajaExt`](../tables/pvMovimientoCajaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_SeleccionarMovimientoCajaPvExt]
*DESCRIPCIÓN	:	OBTIENE LA INFORMACION ADICIONAL DEL MOV. DE CAJA PARA PUNTO DE VENTA DESDE
					EL SISTEMA ADM 8.0
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_SeleccionarMovimientoCajaPvExt]
( 
	@growguid_mov_num UNIQUEIDENTIFIER
)
AS 
    BEGIN
        SELECT p.rowguid_mov_num, S.num_turno, 
			S.co_turno,T.des_turno,
			S.cod_caja, T2.descrip,
			S.user_caj
		FROM pvMovimientoCajaExt P
			INNER JOIN pvTurnoExe S ON P.rowguid_num_turno = S.rowguid
			INNER JOIN pvTurno T ON T.co_turno = S.co_turno
			INNER JOIN saCaja T2 ON T2.cod_caja= S.cod_caja
		WHERE rowguid_mov_num  = @growguid_mov_num
    END
```
