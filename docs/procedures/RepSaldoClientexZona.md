# SP: RepSaldoClientexZona
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <29-07-10>
-- Description:	<Saldo de Clientes por Zona>
-- =============================================
CREATE PROCEDURE [RepSaldoClientexZona]
	-- Add the parameters for the stored procedure here
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Des_d CHAR(100) = NULL ,
    @sCo_Des_h CHAR(100) = NULL ,
    @sCo_Tipcli_d CHAR(6) = NULL ,
    @sCo_Tipcli_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sdFec_Emis SMALLDATETIME = NULL ,
    @sNivel_Saldo CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF ( @sNivel_Saldo IS NULL ) 
            SET @sNivel_Saldo = 'TODO'

	
        SELECT
            C.*, Z.zon_des, ISNULL(dbo.SaldoClienteAUnaFecha(C.co_cli, @sdFec_Emis), 0) AS saldo
        FROM
            saCliente AS C
            INNER JOIN saZona AS Z ON Z.co_zon = C.co_zon
        WHERE
            ( ( @sCo_Cli_d IS NULL
                OR C.co_cli >= @sCo_Cli_d
              )
              AND ( @sCo_Cli_h IS NULL
                    OR C.co_cli <= @sCo_Cli_h
                  )
            )
            AND ( ( @sCo_Des_d IS NULL
                    OR C.cli_des >= @sCo_Des_d
                  )
                  AND ( @sCo_Des_h IS NULL
                        OR C.cli_des <= @sCo_Des_h
                      )
                )
            AND ( ( @sCo_Tipcli_d IS NULL
                    OR C.tip_cli >= @sCo_Tipcli_d
                  )
                  AND ( @sCo_Tipcli_h IS NULL
                        OR C.tip_cli <= @sCo_Tipcli_h
                      )
                )
            AND ( ( @sCo_Zon_d IS NULL
                    OR C.co_zon >= @sCo_Zon_d
                  )
                  AND ( @sCo_Zon_h IS NULL
                        OR C.co_zon <= @sCo_Zon_h
                      )
                )
            AND ( ( @sCo_Seg_d IS NULL
                    OR C.co_seg >= @sCo_Seg_d
                  )
                  AND ( @sCo_Seg_h IS NULL
                        OR C.co_seg <= @sCo_Seg_h
                      )
                )
            AND ( @sCo_Moneda IS NU
```
