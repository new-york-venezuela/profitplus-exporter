# SP: pValidaChequeDevueltoVenta
**Tipo**: Procedimiento
**Módulo**: Clientes

## Tablas Referenciadas
- [`saChequeDevueltoVenta`](../tables/saChequeDevueltoVenta.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidaChequeDevueltoVenta]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Valida si el cheque tiene los datos de origen consistentes
***********************************************************************************************/

CREATE PROCEDURE [pValidaChequeDevueltoVenta] ( @sCo_Cheq CHAR(20) )
AS 
    BEGIN
        DECLARE @Result CHAR(256)
        DECLARE @CoCheq CHAR(20)
        DECLARE @CoCli CHAR(16)
        DECLARE @CoCob CHAR(20)
		SET @Result = ''
        SELECT  @CoCheq = CH.co_cheq_dev ,
                @CoCob = DOCR.cob_num ,
                @CoCli = CLI.co_cli
        FROM    dbo.saChequeDevueltoVenta CH
                LEFT JOIN dbo.saCobroTPReng DOCR ON DOCR.forma_pag = 'CH'
                                                    AND DOCR.num_doc = CH.num_doc
                                                    AND DOCR.cod_caja = CH.cod_caja
                                                    AND DOCR.co_ban = CH.co_ban
                LEFT JOIN dbo.saCobro DOC ON DOC.cob_num = DOCR.cob_num
                LEFT JOIN dbo.saCliente CLI ON cli.co_cli = CH.co_cli
                                               AND DOC.co_cli = CH.co_cli
        WHERE   ( DOCR.cob_num IS NULL
                  OR CLI.co_cli IS NULL
                )
                AND @sCo_Cheq = CH.co_cheq_dev
        
        IF (@CoCheq IS NOT NULL AND @CoCob IS  NULL)
			SET @Result = 'El cheque devuelto no concuerda con valores de numero de documento, caja y banco de renglones de forma de pago.'
        
        IF (@CoCheq IS NOT NULL AND @CoCli IS  NULL)
			SET @Result = 'El cheque devuelto no concuerda con el cliente asociado al cobro.'
                
        SELECT  RTRIM(@Result)
       
    END
```
