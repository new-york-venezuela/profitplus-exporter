# SP: RepComisionRentabXLinea
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saComisionRentabLinea`](../tables/saComisionRentabLinea.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Comision de Rentabilidad por Linea>
 =============================================*/
CREATE PROCEDURE [RepComisionRentabXLinea]
	-- Add the parameters for the stored procedure here
    @sCo_Lin_d CHAR(6) = NULL ,
    @sCo_Lin_h CHAR(6) = NULL ,
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
            'lin' AS tipo, ( LIN.lin_des ) AS art_des, ( C.co_lin ) AS co_art, C.tipo_ven, 
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
            saLineaArticulo AS LIN
            INNER JOIN saComisionRentabLinea AS C ON C.co_lin = LIN.co_lin
        WHERE
            ( ( @sCo_Lin_d IS NULL
                OR LIN.co_lin >= @sCo_Lin_d
              )
              AND ( @sCo_Lin_h IS NULL
                    OR LIN.co_lin <= @sCo_Lin_h
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
            LIN.co_lin
    END
```
