# SP: pValidaChequeDevueltoVentaProcesado
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequeDevueltoVenta`](../tables/saChequeDevueltoVenta.md)
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidaChequeDevueltoVentaProcesado]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	04/12/2015
*DESCRIPCION	:	Valida si el cheque devuelto en venta ya se encuentra procesado
***********************************************************************************************/

CREATE PROCEDURE [dbo].[pValidaChequeDevueltoVentaProcesado] ( @sDep_Num CHAR(20) )
AS 
    BEGIN
        SELECT  chv.num_doc as existe
        FROM    dbo.saMovimientoCaja movCaj
                INNER JOIN saDepositoBancoReng dpr on dpr.mov_afec_c = movCaj.mov_num
				INNER JOIN saChequeDevueltoVenta chv on chv.num_doc = movCaj.num_pago and chv.procesado = 1		
        WHERE  dpr.dep_num = @sDep_Num 
        
    END
```
