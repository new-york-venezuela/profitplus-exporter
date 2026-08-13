# SP: pValidaMovimientoBancoNroDocumento
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidaMovimientoBancoNroDocumento]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Valida si el movimiento de pago se encuentra conciliado
***********************************************************************************************/

CREATE PROCEDURE [pValidaMovimientoBancoNroDocumento] ( @sMovNumero CHAR(20) )
AS 
    BEGIN
	
        SELECT   MB1.mov_num             
        FROM    dbo.saMovimientoBanco MB1
                INNER JOIN dbo.saCuentaBancaria CU1 ON CU1.cod_cta = MB1.cod_cta
        WHERE   EXISTS ( SELECT *
                         FROM   dbo.saMovimientoBanco MB2
                                INNER JOIN dbo.saCuentaBancaria CU2 ON CU2.cod_cta = MB2.cod_cta
						 WHERE  MB1.tipo_op = MB2.tipo_op
                                AND MB1.doc_num = MB2.doc_num
                                AND MB2.anulado = 0 
								AND MB2.mov_num = @sMovNumero 
								AND CU1.co_ban = CU2.co_ban
								AND MB1.cod_cta = MB2.cod_cta
								AND MB1.mov_num <> MB2.mov_num )
                AND MB1.anulado = 0
				
	
    END
```
