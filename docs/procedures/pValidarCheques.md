# SP: pValidarCheques
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 22/10/2009
-- Description:	Valida que los numeros de cheque no esten repetidos en una cuenta
-- =============================================
CREATE PROCEDURE [pValidarCheques]
    @codCta NVARCHAR(6) ,
    @codCheques NVARCHAR(MAX)
AS 
    BEGIN
        DECLARE @query NVARCHAR(MAX)
        SET @query = 'SELECT co_cheq,saChequera.co_chra'
            +' FROM saCheque INNER JOIN saChequera ON saCheque.co_chra = saChequera.co_chra'
			+ ' INNER JOIN saCuentaBancaria ON saCuentaBancaria.cod_cta = saChequera.cod_cta '

			+ ' WHERE saCuentaBancaria.co_ban in (select co_ban from saCuentaBancaria where cod_cta = '
            + '''' + @codCta + '''' + ') AND co_cheq IN (' + @codCheques + ')'

        SET NOCOUNT ON ;

        EXEC (@query) ;
	
        SET NOCOUNT OFF ;
    END
```
