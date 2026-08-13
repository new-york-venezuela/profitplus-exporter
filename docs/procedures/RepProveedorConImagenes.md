# SP: RepProveedorConImagenes
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-07-10>
-- Description:	<Proveedores con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepProveedorConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_TipPro_d CHAR(6) = NULL ,
    @sCo_TipPro_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Nacional CHAR(2) = NULL ,
    @sCo_Inactivo CHAR(2) = NULL ,
    @bCo_Inactivo_Filtro BIT = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL

AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sCo_Inactivo = 'SI' ) 
            SET @bCo_Inactivo_Filtro = 1
        IF ( @sCo_Inactivo = 'NO' ) 
            SET @bCo_Inactivo_Filtro = 0


        SELECT
           P.co_prov, P.prov_des, P.co_seg, P.co_zon, P.tip_pro, P.telefonos, P.rif, TP.des_tipo, 
			dbo.saDocumentoImagen.co_tipo_imag, dbo.saDocumentoImagen.co_imag, dbo.saDocumentoImagen.des_imag, 
            dbo.saDocumentoImagen.picture, dbo.saTipoImagen.descrip
		FROM            dbo.saTipoImagen INNER JOIN
                         dbo.saDocumentoImagen ON dbo.saTipoImagen.co_tipo_imag = dbo.saDocumentoImagen.co_tipo_imag RIGHT OUTER JOIN
                         dbo.saProveedor AS P INNER JOIN
                         dbo.saTipoProveedor AS TP ON TP.tip_pro = P.tip_pro ON dbo.saDocumentoImagen.rowguidDoc = P.rowguid
        WHERE
			saDocumentoImagen.co_tipo_imag is not null and
            ( ( @sCo_Prov_d IS NULL
                OR P.co_prov >= @sCo_Prov_d
              )
              AND ( @sCo_Prov_h IS NULL
                    OR P.co_prov <= @sCo_Prov_h
                  )
            )
            AND ( ( @sCo_TipPro_d IS NULL
                    OR P.tip_pro >= @sCo_TipPro_d
                  )
                  AND ( @sCo_TipPro_h IS NULL
                        OR P.tip_pro <= @sCo_TipPro_h
                      )
                )
            AND ( ( @sCo_Zon_d IS NULL
                    OR P.co_zon >= @sCo_Zon_d
                  )
                  AND ( @sCo_Zon_h IS NULL
                        OR P.co_zon <=
```
