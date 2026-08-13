# SP: RepArticuloCodigoBarra
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <13-04-10>
 Description:	<Articulos con sus Proveedores>
 =============================================*/
CREATE PROCEDURE [RepArticuloCodigoBarra]
	-- Add the parameters for the stored procedure here
    @sCo_ArtProv_d CHAR(30) = NULL ,
    @sCo_ArtProv_h CHAR(30) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sParametroBarra char(3) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

IF @sParametroBarra IS NULL 
	SET @sParametroBarra = 'RAR'


        SELECT
           ART.co_art co_art, 
			CASE @sParametroBarra
				WHEN 'REF' THEN
					ISNULL(('*' + RTRIM(LTRIM(ART.ref)) + '*'),'')
				WHEN 'MOD' THEN
					ISNULL(('*' + RTRIM(LTRIM(ART.modelo)) + '*'),'')
				ELSE
					'*' + RTRIM(LTRIM(ART.CO_art)) + '*'
			END as co_art_barra
			, ART.art_des, ART.fecha_reg 
        FROM
		saArticulo AS ART 
        WHERE
             (( @sCo_ArtProv_d IS NULL
                OR Art.co_art >= @sCo_ArtProv_d
              )
              AND ( @sCo_ArtProv_h IS NULL
                    OR Art.co_art <= @sCo_ArtProv_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR Art.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'art_des' THEN ART.art_des
                                 ELSE ART.co_art
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'art_des' THEN ART.art_des
                                          ELSE ART.co_art
                                        END
                      END ASC


    END
```
