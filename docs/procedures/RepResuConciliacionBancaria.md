# SP: RepResuConciliacionBancaria
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:          SOFTECH SISTEMAS
-- Create date:		<22/01/2016>
-- Last Update Date: 2017-11-03
-- Description:     <Resumen de Conciliación Bancaria>
-- =============================================
CREATE PROCEDURE [dbo].[RepResuConciliacionBancaria] 
       @sCo_cta CHAR(6) = NULL, 
       @iAnho AS INT = NULL, 
       @cMes AS INT = NULL, 
       @sCo_Sucu CHAR(6) = NULL, 
       @iSaldo DECIMAL(18, 2) = 0.00, 
       @sCampOrderBy VARCHAR(16) = NULL, 
       @sDir VARCHAR(6) = NULL, 
       @bHeaderRep BIT = 0
AS
BEGIN
       SET NOCOUNT ON;

       DECLARE @abonosc AS DECIMAL(18, 2)
       DECLARE @cargosc AS DECIMAL(18, 2)
       DECLARE @abonos AS DECIMAL(18, 2)
       DECLARE @cargos AS DECIMAL(18, 2)
       DECLARE @Saldo_ini AS DECIMAL(18, 2)
       DECLARE @Meses AS INT
       DECLARE @cod_cta AS CHAR(6)
       DECLARE @num_cta AS VARCHAR(50)
       DECLARE @co_mone AS CHAR(6)
       DECLARE @co_ban AS CHAR(6)
       DECLARE @des_ban AS VARCHAR(60)
       DECLARE @dtFecha AS SMALLDATETIME
       DECLARE @saldo_final AS DECIMAL(18, 2)
       DECLARE @itfAbono AS DECIMAL(18, 2),
                    @itfCargo AS DECIMAL(18, 2),
                    @itfAbonoC AS DECIMAL(18, 2),
                    @itfCargoC AS DECIMAL(18, 2),
                    @cMesSaldoInicial AS INT,
                    @iAnhoSaldoInicial AS INT
       IF (@sCo_cta IS NULL)
             RAISERROR ('Debe suministrar un Numero de Cuenta', 16, 1)

       IF (@iAnho IS NULL)
             RAISERROR ('Debe suministrar un Año', 16, 1)

       IF (@cMes IS NULL)
             RAISERROR ('Debe suministrar un Mes', 16, 1)

       IF (@cMes > 12 OR @cMes < 1)
             RAISERROR ('El valor del mes debe estar entre 1 y 12', 16, 1)

       set @cMesSaldoInicial = @cMes -1
       set @iAnhoSaldoInicial = @iAnho 

       if(@cMesSaldoInicial = 0)
       BEGIN
             set @cMesSaldoInicial = 12
             set @iAnhoSaldoInicial = @iAnho -1
       END

       SET @dtFecha = DateAdd(day, - 1, DateAdd(month, @cMesSaldoInicial, DateAdd(Year, @iAnhoSaldoInicial - 1900, 0)))

       SELECT @Saldo_ini = dbo.saSaldoConciliacion(@sCo_cta, @sCo_cta, @iAnhoSaldoInicial, @cMesSaldoInicial)

       IF @Saldo_ini IS NULL
             RAISERROR ('El numero de cuenta no tiene movimientos bancarios', 16, 1)

       SELECT @abonosc = ISNULL(SUM(A.monto_h),0),
                    @ca
```
