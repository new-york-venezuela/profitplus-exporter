# SP: pValidarExisteMovimientosBancoConSaldoInicial
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 2021-7-30
-- Last update date: 2022-01-30
-- =============================================
CREATE PROCEDURE [dbo].[pValidarExisteMovimientosBancoConSaldoInicial](@sMovNumero CHAR(20) )
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	--SET NOCOUNT ON;

    SELECT  MB1.mov_num             
        FROM    dbo.saMovimientoBanco MB1
                INNER JOIN dbo.saCuentaBancaria CU1 ON CU1.cod_cta = MB1.cod_cta
        WHERE   CU1.cod_cta = @sMovNumero
				AND MB1.anulado = 0
				AND (MB1.conciliado = 0 or MB1.conciliado = 1)
				AND MB1.saldo_ini = 1 

END
```
