# SP: RepTipoCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saTipoPrecio`](../tables/saTipoPrecio.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <19-07-10>
-- Description:	<Tipo de Clientes>
-- =============================================
CREATE PROCEDURE [RepTipoCliente]
	-- Add the parameters for the stored procedure here
    @sCo_Cli_d CHAR(6) = NULL ,
    @sCo_Cli_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCo_Precio_d CHAR(6) = NULL ,
    @sCo_Precio_h CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            TC.*, TP.des_precio
        FROM
            saTipoCliente AS TC
            INNER JOIN saTipoPrecio AS TP ON TP.co_precio = TC.co_precio
        WHERE
            ( ( @sCo_Cli_d IS NULL
                OR TC.tip_cli >= @sCo_Cli_d
              )
              AND ( @sCo_Cli_h IS NULL
                    OR TC.tip_cli <= @sCo_Cli_h
                  )
            )
            AND ( ( @sCo_Precio_d IS NULL
                    OR TC.co_precio >= @sCo_Precio_d
                  )
                  AND ( @sCo_Precio_h IS NULL
                        OR TC.co_precio <= @sCo_Precio_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR TC.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tipo' THEN TC.des_tipo
                                 ELSE TC.tip_cli
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tipo' THEN TC.des_tipo
                                          ELSE TC.tip_cli
                                        END
                      END ASC
    END
```
