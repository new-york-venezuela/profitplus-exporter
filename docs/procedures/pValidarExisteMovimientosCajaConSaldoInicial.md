# SP: pValidarExisteMovimientosCajaConSaldoInicial
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Sistemas>
-- Create date: <20/01/2022>
-- Description:	<Descripcion>
-- =============================================

CREATE PROCEDURE [dbo].[pValidarExisteMovimientosCajaConSaldoInicial](@sMovNumero CHAR(20))
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	--SET NOCOUNT ON;

    SELECT   MB1.mov_num             
        FROM    dbo.saMovimientoCaja MB1
                INNER JOIN dbo.saCaja CU1 ON CU1.cod_caja= MB1.cod_caja
        WHERE   CU1.cod_caja = @sMovNumero
				AND MB1.anulado = 0
				AND MB1.saldo_ini = 1 
END
```
