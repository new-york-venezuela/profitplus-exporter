# SP: RepArticuloCompuestoDef
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCompuesto`](../tables/saArtCompuesto.md)
- [`saArtCompuestoReng`](../tables/saArtCompuestoReng.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <05-03-10>
 Description:	<Articulos Conpuesto>
 =============================================*/
CREATE PROCEDURE [RepArticuloCompuestoDef]
	-- Add the parameters for the stored procedure here
    @sCo_ArtC_d CHAR(20) = NULL ,
    @sCo_ArtC_h CHAR(20) = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sdFec_Emis_d SMALLDATETIME = NULL ,
    @sdFec_emis_h SMALLDATETIME = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        SELECT
            A.*, B.*, ARTE.art_des AS art_des_enc, ARTE.modelo AS modelo_enc, ARTR.art_des AS art_des_ren,
            ARTR.modelo AS modelo_ren
        FROM
            saArtCompuesto A
            INNER JOIN saArtCompuestoReng B ON A.co_artc = B.co_artc
            INNER JOIN saArticulo ARTE ON ARTE.co_art = A.co_art
            INNER JOIN saArticulo ARTR ON ARTR.co_art = B.co_art
        WHERE
            ( ( @sCo_ArtC_d IS NULL
                OR A.co_artc >= @sCo_ArtC_d
              )
              AND ( @sCo_ArtC_h IS NULL
                    OR A.co_artc <= @sCo_ArtC_h
                  )
            )
            AND ( ( @sCo_Art_d IS NULL
                    OR ARTE.co_art >= @sCo_Art_d
                  )
                  AND ( @sCo_Art_h IS NULL
                        OR ARTE.co_art <= @sCo_Art_h
                      )
                )
            AND ( ( @sdFec_Emis_d IS NULL
                    OR A.fec_emis >= @sdFec_Emis_d
                  )
                  AND ( @sdFec_Emis_h IS NULL
                        OR DATEDIFF(dd, 0, A.fec_emis) <= @sdFec_Emis_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR A.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'Co_Art' THEN A.co_art
                                 ELSE A.Co_ArtC
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'Co_Art' THEN A.co_art
                                          ELSE A.Co_ArtC
                                        END
```
