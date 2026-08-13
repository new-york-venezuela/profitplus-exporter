# SP: RepCompuestoGenxNum
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <15-04-10>
 Description:	<Conpuestos Generados por Número>
 =============================================*/
CREATE PROCEDURE [RepCompuestoGenxNum]
	-- Add the parameters for the stored procedure here
    @sCo_ArtComGen_d CHAR(20) = NULL ,
    @sCo_ArtComGen_h CHAR(20) = NULL ,
    @sCo_NumComGen_d CHAR(20) = NULL ,
    @sCo_NumComGen_h CHAR(20) = NULL ,
    @sdFec_Emis_d SMALLDATETIME = NULL ,
    @sdFec_Emis_h SMALLDATETIME = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCompuestoGen CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
--VALOR POR DEFECTO
        IF ( @sCompuestoGen IS NULL ) 
            SET @sCompuestoGen = 'SIT'
--VALOR POR DEFECTO
        SELECT
            ARTC.co_art AS Compuesto, ARTC.descrip AS Descri_comp, ARTE.art_des AS Artículo_des,
            ARTE.modelo AS Modelo_art, ARTC.co_uni, A.*
        FROM
            saArtCompuestoGen AS A
            INNER JOIN saArticulo ARTE ON ARTE.co_art = A.co_art
            INNER JOIN saArtCompuesto AS ARTC ON ARTC.co_art = A.co_art
        WHERE
            ( ( @sCo_ArtComGen_d IS NULL
                OR A.co_art >= @sCo_ArtComGen_d
              )
              AND ( @sCo_ArtComGen_h IS NULL
                    OR A.co_art <= @sCo_ArtComGen_h
                  )
            )
            AND ( ( @sCo_NumComGen_d IS NULL
                    OR A.gene_num >= @sCo_NumComGen_d
                  )
                  AND ( @sCo_NumComGen_h IS NULL
                        OR A.gene_num <= @sCo_NumComGen_h
                      )
                )
            AND ( ( @sdFec_Emis_d IS NULL
                    OR DATEADD(day, 0, A.fecha) >= @sdFec_Emis_d
                  )
                  AND ( @sdFec_Emis_h IS NULL
                        OR DATEDIFF(day, 0, A.fecha) <= @sdFec_Emis_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR A.co_sucu_in = @sCo_Sucursal
                )
            AND ( ( @sCompuestoGen = 'TODO' )
                  OR ( @sCompuestoGen = 'SIT'
                       AND A.gene_art = 1
                     )
                  OR ( @sCompuestoGen = 'NOT'
                       AND A.gene_art = 0
                     )
                )
        ORDER BY
            CASE
```
