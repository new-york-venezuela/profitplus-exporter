# SP: RepClientesSinMovimientos
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-06-2010>
-- Description:   <Clientes sin Movimientos>
-- =============================================
CREATE PROCEDURE [RepClientesSinMovimientos]
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN   
        SET NOCOUNT ON ;
      
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)
            

        SELECT
            C.co_cli, C.cli_des, ( dbo.SaldoClienteAUnaFecha(C.co_cli, @dFecha_d - 1) ) AS saldo
        FROM
            saCliente C
        WHERE
            C.co_cli NOT IN ( SELECT
                                co_cli
                              FROM
                                saDocumentoVenta
                              WHERE
                                ( ( @dFecha_d IS NULL
                                    OR dbo.FechaSimple(fec_emis) >= @dFecha_d
                                  )
                                  AND ( @dFecha_h IS NULL
                                        OR dbo.FechaSimple(fec_emis) <= @dFecha_h
                                      )
                                )
                                AND ( @sCo_Moneda IS NULL
                                      OR @sCo_Moneda = co_mone
                                    )
                                AND ( @sCo_Sucursal IS NULL
                                      OR co_sucu_in = @sCo_Sucursal
                                    )
                                AND ( anulado = 0 ) )
            AND ( ( @sCo_Cli_d IS NULL
                    OR C.co_cli >= @sCo_Cli_d
                  )
                  AND ( @sCo_Cli_h IS NULL
                        OR C.co_cli <= @sCo_Cli_h
                      )
                )
        GROUP BY
            C.co_cli, C.cli_des
        ORDER BY
            C.co_cli
      
    END
```
