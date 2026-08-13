# SP: pObtenerSaldoCajaActiva
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SOFTECH SISTEMAS>
-- Create date: <2011-01-01>
-- =============================================
CREATE PROCEDURE [pObtenerSaldoCajaActiva]
AS 
    BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
        SET NOCOUNT ON ;

        SELECT DISTINCT
            c.cod_caja AS CodCaja, c.descrip AS Descripcion,
            CASE WHEN [dbo].[ObtenerMonedaBase]() = c.co_mone THEN ROUND([dbo].[SaldoCajaxTipo](c.cod_caja, 'TF'), 2)
                 ELSE ROUND([dbo].[SaldoCajaxTipo](c.cod_caja, 'TF') * [dbo].[TasaAUnaFecha](c.co_mone, 1, GETDATE()), 2)
            END AS SaldoCaja, c.co_mone AS Moneda, [dbo].[TasaAUnaFecha](c.co_mone, 1, GETDATE()) AS Tasa,
            CASE WHEN [dbo].[ObtenerMonedaBase]() = c.co_mone THEN 0
                 ELSE [dbo].[SaldoCajaxTipo](c.cod_caja, 'TF')
            END AS SaldoOM
        FROM
            [saCaja] c ,
            [saSaldoCaja] s
        WHERE
            c.inactivo = 0
            AND c.cod_caja = s.cod_caja
   
    END
```
