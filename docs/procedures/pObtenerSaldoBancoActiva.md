# SP: pObtenerSaldoBancoActiva
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <2011-01-01>
-- =============================================
CREATE PROCEDURE [pObtenerSaldoBancoActiva]
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT DISTINCT
            c.cod_cta AS CodCtta, c.num_cta AS numCtta, s.des_ban,
            CASE WHEN [dbo].[ObtenerMonedaBase]() = c.co_mone THEN ROUND([dbo].[SaldoBancoxTipo](c.cod_cta, 'TF'), 2)
                 ELSE ROUND([dbo].[SaldoBancoxTipo](c.cod_cta, 'TF') * [dbo].[TasaAUnaFecha](c.co_mone, 1, GETDATE()), 2)
            END AS SaldoBanco, c.co_mone AS Moneda, [dbo].[TasaAUnaFecha](c.co_mone, 1, GETDATE()) AS Tasa,
            CASE WHEN [dbo].[ObtenerMonedaBase]() = c.co_mone THEN 0
                 ELSE [dbo].[SaldoBancoxTipo](c.cod_cta, 'TF')
            END AS SaldoOM
        FROM
            [saCuentaBancaria] c ,
            [saBanco] s
        WHERE
            c.inactivo = 0
            AND c.co_ban = s.co_ban
   
    END
```
