# SP: pSaldoActualizar
**Tipo**: Procedimiento
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saSaldoBanco`](../tables/saSaldoBanco.md)
- [`saSaldoCaja`](../tables/saSaldoCaja.md)

## Código (excerpt)
```sql
/******************************************************************************************************
*NOMBRE			: [pSaldoActualizar]
*DESCRIPCIÓN	: Sumar o Resta saldo en la tabla de SaldoBanco o SaldoCaja según sea el caso
*AUTOR			: SOFTECH SISTEMAS
*FECHA			: 2010-10-07
*NOTA 1			: El monto que reciba este SP ya deberia estar en la misma moneda que la cuenta/caja
*******************************************************************************************************/
CREATE PROCEDURE [dbo].[pSaldoActualizar]
    (
      @sCodigo CHAR(6) , --Código de la Cuenta/Caja
      @sForma_Pag CHAR(2) ,
      @sTipoSaldo CHAR(2) ,
      @deMonto DECIMAL(18, 2) ,
      @bSumarSaldo BIT ,
      @sModulo CHAR(6) , -- nombre del modulo, (COBRO, PAgo, etc)
      @bPermiteSaldoNegativo BIT
    )
AS 
    BEGIN	
        DECLARE @intResultCajaVsCaja INTEGER
        DECLARE @intResultado INTEGER
        DECLARE @intExisteRegistro INTEGER
        DECLARE @deSaldoFinal DECIMAL(18, 2)
        DECLARE @TableResultSaldo TABLE
            (
              saldoFinal DECIMAL(18, 2)
            )
        DECLARE @MensajeError VARCHAR(256)
        DECLARE @nombreProceso CHAR(13)
        DECLARE @isCaja BIT
        DECLARE @isBanco BIT
	
        DECLARE @TranCounter INT ;
        SET @TranCounter = @@TRANCOUNT ;

        SET @isCaja = 0
        SET @isBanco = 0

        IF ( @bSumarSaldo = 0 ) 
            SET @deMonto = @deMonto * -1.00000
		
        IF ( @sModulo = 'PAGO' ) 
            BEGIN
                IF ( @sForma_Pag = 'EF' ) 
                    BEGIN
                        SET @nombreProceso = 'CAJA'
                        SET @isCaja = 1
                    END
		
                IF ( @sForma_Pag = 'CH'
                     OR @sForma_Pag = 'TR'
                   ) 
                    BEGIN
                        SET @nombreProceso = 'CUENTA'
                        SET @isBanco = 1
                    END
            END 
	
        IF ( @sModulo = 'COBRO' ) 
            BEGIN
                IF ( @sForma_Pag = 'EF'
                     OR @sForma_Pag = 'CH'
                     OR @sForma_Pag = 'TJ'
                   ) 
                    BEGIN
                        SET @nombreProceso = 'CAJA'
                        SET @isCaja = 1
                    END
		
                IF ( @sForma_Pag = 'DP' 
					OR @sForma_Pag = 'TP') 
                    BEGIN
                        SET @nombrePr
```
