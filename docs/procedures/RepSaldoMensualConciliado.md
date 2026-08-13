# SP: RepSaldoMensualConciliado
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <22/01/2016>
-- Last Update Date: 2017-09-15
-- Description:	<Saldo Mensual Conciliado>
-- =============================================
CREATE PROCEDURE [dbo].[RepSaldoMensualConciliado]
    @sCo_CodCuenta_d CHAR(6) = NULL ,
    @sCo_CodCuenta_h CHAR(6) = NULL ,
    @sCo_CuentaIngr_d CHAR(20) = NULL ,
    @sCo_CuentaIngr_h CHAR(20) = NULL ,
    @iMes INT = NULL ,
    @iAnho INT = NULL ,
    @sCo_Sucursal INT = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        BEGIN


            IF ( @iMes IS NULL ) 
                BEGIN
                    RAISERROR('Debe seleccionar un Mes.',16,1)
                    RETURN
                END
                
            IF ( @iAnho IS NULL ) 
                BEGIN
                    RAISERROR('Debe seleccionar un Año.',16,1)
                    RETURN
                END

            DECLARE @dtFecha AS SMALLDATETIME


            SET @dtFecha = dbo.UltimoDiaMes(@iAnho, @iMes)

        END

        SELECT  CU.num_cta,
                CU.inactivo ,
                CU.co_mone ,
                MO.mone_des ,
                BA.co_ban ,
                BA.des_ban ,
                CU.cod_cta,
				SUM(CASE WHEN MB.conciliado = 1 THEN MB.monto_h - MB.monto_d + MB.idb *(case when MB.monto_h<=0 then 1 else -1 end) ELSE 0.00 END) AS saldo_conc ,
				SUM(MB.monto_h - MB.monto_d + MB.idb*(case when MB.monto_h<=0 then 1 else -1 end)) AS saldo_lib ,
                @dtFecha - 1 AS fecha_con,
                CU.Campo1,
                CU.Campo2,
                CU.Campo3,
                CU.Campo4,
                CU.Campo5,
                CU.Campo6,
                CU.Campo7,
                CU.Campo8
                
                
        FROM    saMovimientoBanco AS MB
                INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
                INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
                INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
        WHERE   ( ( @sCo_CodCuenta_d IS NULL
                    OR CU.cod_cta >= @sCo_CodCuenta_d
                  )
                  AND ( @sCo_CodCuenta_h IS NULL
                        OR CU.cod_cta <= @sCo_CodCuenta_h
                      )
                )
                AND
```
