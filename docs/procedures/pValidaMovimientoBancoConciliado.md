# SP: pValidaMovimientoBancoConciliado
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pValidaMovimientoBancoConciliado
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Valida si el Cobro o Pago tiene un movimiento de Banco Conciliado
***********************************************************************************************/

CREATE PROCEDURE [pValidaMovimientoBancoConciliado]
    (
      @sDocNum CHAR(20) ,
      @sOrigen CHAR(1)
    )
AS 
    BEGIN
        DECLARE @Result CHAR(20)
		
        SET @Result = ''
        IF ( @sOrigen = 'C' ) 
            BEGIN
                SELECT TOP 1
                        @Result = MOV.mov_num
                FROM    dbo.saMovimientoBanco MOV
                WHERE   MOV.conciliado = 1
                        AND MOV.mov_num IN ( SELECT FP.mov_num_b
                                             FROM   dbo.saCobroTPReng FP
                                             WHERE  FP.cob_num = @sDocNum )
                  
            END
        IF ( @sOrigen = 'P' ) 
            BEGIN
                SELECT TOP 1
                        @Result = MOV.mov_num
                FROM    dbo.saMovimientoBanco MOV
                WHERE   MOV.conciliado = 1
                        AND MOV.mov_num IN ( SELECT FP.mov_num_b
                                             FROM   dbo.saPagoTPReng FP
                                             WHERE  FP.cob_num = @sDocNum )
            END
        SELECT  RTRIM(@Result)
       
    END
```
