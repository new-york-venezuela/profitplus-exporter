# SP: RepComisionRentabXArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saComisionRentabArticulo`](../tables/saComisionRentabArticulo.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Comision de Rentabilidad por Articulo>
 =============================================*/
CREATE PROCEDURE [RepComisionRentabXArticulo]
	-- Add the parameters for the stored procedure here
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
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
            'art' AS tipo, ART.art_des, C.co_art, C.tipo_ven, (CASE WHEN C.aplica_en = 'C' THEN 'COBROS' ELSE 'VENTAS' END) AS aplica_en,
            C.hasta1, C.hasta2, C.hasta3, C.hasta4, C.hasta5, C.porc1,
            C.porc2, C.porc3, C.porc4, C.porc5, C.porc6, ( CASE WHEN C.tipo_ven = 'A' THEN 'TIPO A'
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
                                                           END ) AS des_ven, U.des_uni
        FROM
            saArticulo AS ART
            INNER JOIN saComisionRentabArticulo AS C ON C.co_art = ART.co_art
            LEFT JOIN saArtUnidad AS AU ON AU.co_art = C.co_art
                                           AND AU.uni_principal = 1
            LEFT JOIN saUnidad AS U ON U.co_uni = AU.co_uni
        WHERE
            ( ( @sCo_Art_d IS NULL
                OR ART.co_art >= @sCo_Art_d
              )
              AND
```
