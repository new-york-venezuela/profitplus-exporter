# SP: pv_SeleccionarFacturaVentaPvExt
**Tipo**: Punto de Venta
**Módulo**: Tesorería

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`pvTurno`](../tables/pvTurno.md)
- [`pvTurnoExe`](../tables/pvTurnoExe.md)
- [`saCaja`](../tables/saCaja.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_SeleccionarFacturaVentaPvExt]
*DESCRIPCIÓN	:	OBTIENE LA INFORMACION ADICIONAL DE LA FACTURA DE VENTA PARA PUNTO DE VENTA DESDE
					EL SISTEMA ADM 8.0
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_SeleccionarFacturaVentaPvExt]
(
	@growguid_doc_num UNIQUEIDENTIFIER
)
AS 
    BEGIN
        SELECT p.rowguid_doc_num, P.estado, S.num_turno, 
			S.co_turno,T.des_turno,
			S.cod_caja, T2.descrip,
			S.user_caj
		FROM pvFacturaVentaExt P
			INNER JOIN pvTurnoExe S ON P.rowguid_num_turno = S.rowguid
			INNER JOIN pvTurno T ON T.co_turno = S.co_turno
			INNER JOIN saCaja T2 ON T2.cod_caja= S.cod_caja
		WHERE rowguid_doc_num = @growguid_doc_num
    END
```
