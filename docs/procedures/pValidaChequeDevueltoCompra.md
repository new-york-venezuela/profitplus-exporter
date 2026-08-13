# SP: pValidaChequeDevueltoCompra
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	[pValidaChequeDevueltoCompra]
*AUTOR			:	SOFTECH SISTEMAS	
*FECHA			:	26/07/2010
*DESCRIPCION	:	Valida si el cheque tiene los datos de origen consistentes
***********************************************************************************************/

CREATE PROCEDURE [pValidaChequeDevueltoCompra] ( @sCo_Cheq CHAR(20) )
AS 
    BEGIN
    
        DECLARE @Result CHAR(256)
        DECLARE @CoCheq CHAR(20)
        DECLARE @CoCli CHAR(16)
        DECLARE @CoCob CHAR(20)
		SET @Result = ''
        SELECT  @CoCheq = CH.co_cheq_dev ,
                @CoCob = DOCR.cob_num ,
                @CoCli = CLI.co_prov
        FROM    dbo.saChequeDevueltoCompra CH
                LEFT JOIN dbo.saPagoTPReng DOCR ON DOCR.forma_pag = 'CH'
                                                    AND DOCR.num_doc = CH.num_doc
                                                    AND DOCR.cod_cta = CH.cod_cta
                LEFT JOIN dbo.saPago DOC ON DOC.cob_num = DOCR.cob_num
                LEFT JOIN dbo.saProveedor CLI ON cli.co_prov = CH.co_prov
                                               AND DOC.co_prov = CH.co_prov
        WHERE   ( DOCR.cob_num IS NULL
                  OR CLI.co_prov IS NULL
                )
                AND @sCo_Cheq = CH.co_cheq_dev
        
        IF (@CoCheq IS NOT NULL AND @CoCob IS  NULL)
			SET @Result = 'El cheque devuelto no concuerda con valores de numero de documento, caja y banco de renglones de forma de pago.'
        
        IF (@CoCheq IS NOT NULL AND @CoCli IS  NULL)
			SET @Result = 'El cheque devuelto no concuerda con el proveedor asociado al cobro.'
                
        SELECT  RTRIM(@Result)
       
    END
```
