# SP: RepDescuentoXArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saDescArticulo`](../tables/saDescArticulo.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Descuento por Articulo>
 =============================================*/
CREATE PROCEDURE [RepDescuentoXArticulo]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
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
            'art' AS tipo, ART.art_des, D.co_art, D.tip_cli, D.hasta1, D.hasta2, D.hasta3, D.hasta4, D.hasta5, D.porc1,
            D.porc2, D.porc3, D.porc4, D.porc5, D.porc6, TC.des_tipo, U.des_uni
        FROM
            saArticulo AS ART
            INNER JOIN saDescArticulo AS D ON D.co_art = ART.co_art
            INNER JOIN saTipoCliente TC ON TC.tip_cli = D.tip_cli
            LEFT JOIN saArtUnidad AS AU ON AU.co_art = D.co_art
                                           AND AU.uni_principal = 1
            LEFT JOIN saUnidad AS U ON U.co_uni = AU.co_uni
        WHERE
            ( ( @sCo_Art_d IS NULL
                OR ART.co_art >= @sCo_Art_d
              )
              AND ( @sCo_Art_h IS NULL
                    OR ART.co_art <= @sCo_Art_h
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
            ART.co_art
    END
```
