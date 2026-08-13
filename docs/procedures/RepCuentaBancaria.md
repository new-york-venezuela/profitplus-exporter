# SP: RepCuentaBancaria
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Reportes de cuentas bancarias>
-- =============================================
CREATE PROCEDURE [RepCuentaBancaria]
	-- Add the parameters for the stored procedure here
    @sNu_Cuen_d CHAR(6) = NULL ,
    @sNu_Cuen_h CHAR(6) = NULL ,
    @sCo_ban_d CHAR(6) = NULL ,
    @sCo_ban_h CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            CB.*, CB.telefonos as telefono, B.des_ban
        FROM
            saCuentaBancaria AS CB
            INNER JOIN saBanco AS B ON B.co_ban = CB.co_ban
        WHERE
            ( ( @sCo_ban_d IS NULL
                OR CB.co_ban >= @sCo_ban_d
              )
              AND ( @sCo_ban_h IS NULL
                    OR CB.co_ban <= @sCo_ban_h
                  )
            )
            AND ( ( @sNu_Cuen_d IS NULL
                    OR cod_cta >= @sNu_Cuen_d
                  )
                  AND ( @sNu_Cuen_h IS NULL
                        OR cod_cta <= @sNu_Cuen_h
                      )
                )
            AND ( @sCo_Moneda IS NULL
                  OR co_mone = @sCo_Moneda
                )
            AND ( @sCo_Sucursal IS NULL
                  OR CB.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'cod_cta' THEN cod_cta
                                 ELSE CB.co_ban
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'cod_cta' THEN cod_cta
                                          ELSE CB.co_ban
                                        END
                      END ASC
    END
```
