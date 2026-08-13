# SP: RepDescuentoXCategoria
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saDescCategoria`](../tables/saDescCategoria.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Descuento por Categoria>
 =============================================*/
CREATE PROCEDURE [RepDescuentoXCategoria]
	-- Add the parameters for the stored procedure here
    @sCo_Cat_d CHAR(6) = NULL ,
    @sCo_Cat_h CHAR(6) = NULL ,
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
            'cat' AS tipo, ( CAT.cat_des ) AS art_des, ( D.co_cat ) AS co_art, D.tip_cli, D.hasta1, D.hasta2, D.hasta3,
            D.hasta4, D.hasta5, D.porc1, D.porc2, D.porc3, D.porc4, D.porc5, D.porc6, TC.des_tipo
        FROM
            saCatArticulo AS CAT
            INNER JOIN saDescCategoria AS D ON D.co_cat = CAT.co_cat
            INNER JOIN saTipoCliente TC ON TC.tip_cli = D.tip_cli
        WHERE
            ( ( @sCo_Cat_d IS NULL
                OR CAT.co_cat >= @sCo_Cat_d
              )
              AND ( @sCo_Cat_h IS NULL
                    OR CAT.co_cat <= @sCo_Cat_h
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
            CAT.co_cat




    END
```
