# SP: RepComisionRentabXCategoria
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saComisionRentabCategoria`](../tables/saComisionRentabCategoria.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Comision de Rentabilidad por Categoria>
 =============================================*/
CREATE PROCEDURE [RepComisionRentabXCategoria]
	-- Add the parameters for the stored procedure here
    @sCo_Cat_d CHAR(6) = NULL ,
    @sCo_Cat_h CHAR(6) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Apli CHAR(1) = NULL,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            'cat' AS tipo, ( CAT.cat_des ) AS art_des, ( C.co_cat ) AS co_art, C.tipo_ven, 
            (CASE WHEN C.aplica_en = 'C' THEN 'COBROS' ELSE 'VENTAS' END) AS aplica_en, C.hasta1, C.hasta2, C.hasta3,
            C.hasta4, C.hasta5, C.porc1, C.porc2, C.porc3, C.porc4, C.porc5, C.porc6,
            ( CASE WHEN C.tipo_ven = 'A' THEN 'TIPO A'
                   WHEN C.tipo_ven = 'B' THEN 'TIPO B'
                   WHEN C.tipo_ven = 'C' THEN 'TIPO C'
                   WHEN C.tipo_ven = 'D' THEN 'TIPO D'
                   WHEN C.tipo_ven = 'E' THEN 'TIPO E'
                   WHEN C.tipo_ven = 'F' THEN 'TIPO F'
                   WHEN C.tipo_ven = 'G' THEN 'TIPO G'
                   WHEN C.tipo_ven = 'H' THEN 'TIPO H'
                   WHEN C.tipo_ven = 'I' THEN 'TIPO I'
                   WHEN C.tipo_ven = 'J' THEN 'TIPO J'
                   ELSE ''
              END ) AS des_ven
        FROM
            saCatArticulo AS CAT
            INNER JOIN saComisionRentabCategoria AS C ON C.co_cat = CAT.co_cat
        WHERE
            ( ( @sCo_Cat_d IS NULL
                OR CAT.co_cat >= @sCo_Cat_d
              )
              AND ( @sCo_Cat_h IS NULL
                    OR CAT.co_cat <= @sCo_Cat_h
                  )
            )
            AND ( ( @sCo_Ven_d IS NULL
                    OR C.tipo_ven >= @sCo_Ven_d
                  )
                  AND ( @sCo_Ven_h IS NULL
                        OR C.tipo_ven <= @sCo_Ven_h
                      )
                )
            AND ( @sCo_Apli IS NULL OR @sCo_Apli = C.aplica_en)
            AND ( @sCo_Sucursal IS NULL
                  OR C.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CAT.co_cat




    END
```
