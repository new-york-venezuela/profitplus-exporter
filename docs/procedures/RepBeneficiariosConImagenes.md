# SP: RepBeneficiariosConImagenes
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Listado de Beneficiarios con sus Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepBeneficiariosConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_bene_d CHAR(10) = NULL ,
    @sCo_bene_h CHAR(10) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0 ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT        dbo.saBeneficiario.cod_ben, dbo.saBeneficiario.ben_des, dbo.saBeneficiario.rif,  
		dbo.saBeneficiario.telefonos, dbo.saBeneficiario.tipo_per, 
		dbo.saDocumentoImagen.co_tipo_imag,dbo.saDocumentoImagen.des_imag, dbo.saDocumentoImagen.picture, 
		dbo.saDocumentoImagen.co_imag, dbo.saTipoImagen.descrip

		FROM            dbo.saDocumentoImagen INNER JOIN
                         dbo.saTipoImagen ON dbo.saDocumentoImagen.co_tipo_imag = dbo.saTipoImagen.co_tipo_imag RIGHT OUTER JOIN
                         dbo.saBeneficiario ON dbo.saDocumentoImagen.rowguidDoc = dbo.saBeneficiario.rowguid

        WHERE
			saDocumentoImagen.co_tipo_imag is not null and
            ( ( @sCo_bene_d IS NULL
                OR saBeneficiario.cod_ben >= @sCo_bene_d
              )
              AND ( @sCo_bene_h IS NULL
                    OR saBeneficiario.cod_ben <= @sCo_bene_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR saBeneficiario.co_sucu_in = @sCo_Sucursal
                )
			AND ( @sCo_tipo_img_d IS NULL
                  OR saTipoImagen.co_tipo_imag >= @sCo_tipo_img_d
                )
			AND ( @sCo_tipo_img_h IS NULL
                  OR saTipoImagen.co_tipo_imag <= @sCo_tipo_img_h
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'ben_des' THEN ben_des
                                 ELSE cod_ben
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'ben_des' THEN ben_des
                                          ELSE cod_ben
                                        END
                      END ASC
    END
```
