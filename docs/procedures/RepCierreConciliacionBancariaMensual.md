# SP: RepCierreConciliacionBancariaMensual
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saConciliacionAutoReng`](../tables/saConciliacionAutoReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/01/2016>
-- Description:	CierreConciliacionBancariaMensual
-- =============================================
CREATE  PROCEDURE [dbo].[RepCierreConciliacionBancariaMensual]
    @sCo_cta CHAR(6) = NULL ,
    @iAnho AS INT = NULL ,
    @cMes AS INT = NULL,
       @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        DECLARE @dtFecha AS SMALLDATETIME
             DECLARE @inicio AS DECIMAL(18,2)
        DECLARE @Saldo_ini AS DECIMAL(18, 2)
             DECLARE @abonosc AS DECIMAL(18, 2) 
        DECLARE @cargosc AS DECIMAL(18, 2)
             DECLARE @abonos AS DECIMAL(18, 2)
        DECLARE @cargos AS DECIMAL(18, 2)
             DECLARE @iSaldo DECIMAL(18, 2)
             
             --SET @iSaldo = 0.00
       select @iSaldo =   saldoEc from  saConciliacionAutoReng car 
      Where ( @sCo_cta IS NULL OR car.cod_cta = @sCo_cta ) 
      AND ( car.anoArchivo = @iAnho and  car.mesArchivo = @cMes )
       
        IF ( @sCo_cta IS NULL ) 
            RAISERROR('Debe suministrar un Numero de Cuenta',16,1)  

        IF ( @iAnho IS NULL ) 
            RAISERROR('Debe suministrar un Año',16,1)  

        IF ( @cMes IS NULL ) 
            RAISERROR('Debe suministrar un Mes',16,1)  
           
        IF ( @cMes > 12 OR @cMes < 1) 
            RAISERROR('El valor del mes debe estar entre 1 y 12',16,1)  
              
        SET @dtFecha =  DateAdd(day, - 1,DateAdd(month, @cMes - 1,DateAdd(Year, @iAnho-1900, 0)))
              
        SET @inicio = ISNULL((select sum(monto_h - monto_d) from saMovimientoBanco where saldo_ini = 1 and cod_cta = @sCo_cta), 0)

             --1.Saldo inicial conciliados 
        SELECT
            @Saldo_ini =((CASE WHEN SUM(A.monto_h) IS NULL THEN 0.00 ELSE SUM(A.monto_h) END)+@inicio)-(CASE WHEN SUM(A.monto_d) IS NULL THEN 0.00 
                    ELSE SUM(A.monto_d) END) FROM saMovimientoBanco A
        WHERE A.conciliado = 1 AND A.saldo_ini= 0 AND A.anulado = 0 AND ( @sCo_cta IS NULL OR A.cod_cta = @sCo_cta )
        AND ( YEAR(A.fec_con) < YEAR(@dtFecha) OR ( YEAR(A.fec_con) = YEAR(@dtFecha) AND MONTH(A.fec_con) = MONTH(@dtFecha))
                                OR ( YEAR(A.fec_con) = YEAR(@dtFecha) AND MONTH(A.fec_con) = MONTH(@dtFecha) AND DAY(A.fec_con) <= DAY(@dtFecha)))
        
        IF (
```
