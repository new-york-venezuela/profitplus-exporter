# SP: pValidarMovimientoCajaNroDocumento
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidarMovimientoCajaNroDocumento]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	18/06/2015
*DESCRIPCION	:	Valida si el movimiento de cobro se encuentra asociado a otro cobro
***********************************************************************************************/

CREATE PROCEDURE [dbo].[pValidarMovimientoCajaNroDocumento] ( @sMovNumero CHAR(20) )
AS 
    BEGIN
	
        SELECT   MC1.mov_num             
        FROM    dbo.saMovimientoCaja MC1
                INNER JOIN dbo.saCaja CA1 ON CA1.cod_caja = MC1.cod_caja
        WHERE   EXISTS ( SELECT *
                         FROM   dbo.saMovimientoCaja MC2
                               INNER JOIN dbo.saCaja CA2 ON CA2.cod_caja = MC2.cod_caja
						 WHERE  MC1.tipo_mov = MC2.tipo_mov
								AND MC1.forma_pag = MC2.forma_pag
								AND MC1.num_pago = MC2.num_pago
								AND MC1.co_ban = MC2.co_ban
                                AND MC2.anulado = 0 
								AND MC1.mov_num <> MC2.mov_num 
								AND MC2.mov_num = @sMovNumero)
                AND MC1.anulado = 0
    END
```
