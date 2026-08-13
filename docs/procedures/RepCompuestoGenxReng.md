# SP: RepCompuestoGenxReng
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <15-04-10>
 Description:	<Conpuesto Generado por Renglones>
 =============================================*/
CREATE PROCEDURE [RepCompuestoGenxReng]
	-- Add the parameters for the stored procedure here
    @sCo_ArtComGen_d CHAR(20) = NULL ,
    @sCo_ArtComGen_h CHAR(20) = NULL ,
    @sCo_ArtComGenReng_d CHAR(20) = NULL ,
    @sCo_ArtComGenReng_h CHAR(20) = NULL ,
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
            ARTE.art_des AS art_des_enc, ARTC.art_des AS art_des_reng, ARTC.modelo AS Modelo_art_reng,
            AC.co_uni AS co_uni_enc, 
			A.*, 
			B.co_uni as co_uni_detalle, 
			B.gene_num as gene_detalle, 
			B.co_art as co_art_detalle,
			B.total_art as total_art_detalle
        FROM
            saArtCompuestoGen AS A
            INNER JOIN saArtCompuestoGenReng AS B ON A.gene_num = B.gene_num
            INNER JOIN saArticulo AS ARTE ON ARTE.co_art = A.co_art
            INNER JOIN saArticulo AS ARTC ON ARTC.co_art = B.co_art
            INNER JOIN saArtCompuesto AS AC ON AC.co_art = A.co_art
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
                    OR dbo.fechasimple(A.fecha) >= @sdFec_Emis_d
                  )
                  AND ( @sdFec_Emis_h IS NULL
                        OR dbo.fechasimple(A.fecha) <= @sdFec_Emis_h
                      )
                )
            AND ( ( @sCo_ArtComGenReng_d IS NULL
```
