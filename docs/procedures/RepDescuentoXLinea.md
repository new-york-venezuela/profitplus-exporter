# SP: RepDescuentoXLinea
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saDescLinea`](../tables/saDescLinea.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Descuento por Linea>
 =============================================*/
CREATE PROCEDURE [RepDescuentoXLinea]
	-- Add the parameters for the stored procedure here
    @sCo_Lin_d CHAR(6) = NULL ,
    @sCo_Lin_h CHAR(6) = NULL ,
    @sCo_Cli_d CHAR(6) = NULL ,
    @sCo_Cli_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            'lin' AS tipo, ( LIN.lin_des ) AS art_des, ( D.co_lin ) AS co_art, D.tip_cli, D.hasta1, D.hasta2, D.hasta3,
            D.hasta4, D.hasta5, D.porc1, D.porc2, D.porc3, D.porc4, D.porc5, D.porc6, TC.des_tipo
        FROM
            saLineaArticulo AS LIN
            INNER JOIN saDescLinea AS D ON D.co_lin = LIN.co_lin
            INNER JOIN saTipoCliente TC ON TC.tip_cli = D.tip_cli
        WHERE
            ( ( @sCo_Lin_d IS NULL
                OR LIN.co_lin >= @sCo_Lin_d
              )
              AND ( @sCo_Lin_h IS NULL
                    OR LIN.co_lin <= @sCo_Lin_h
                  )
            )
            AND ( ( @sCo_Cli_d IS NULL
                    OR D.tip_cli >= @sCo_Cli_d
                  )
                  AND ( @sCo_Cli_h IS NULL
                        OR D.tip_cli <= @sCo_Cli_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR D.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            LIN.co_lin
    END
```
