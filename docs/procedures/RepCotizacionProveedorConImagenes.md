# SP: RepCotizacionProveedorConImagenes
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saCotizacionProveedor`](../tables/saCotizacionProveedor.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/12/2014>
-- Description:	<Reporte de Cotizaciones de Proveedores con sus Renglones con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepCotizacionProveedorConImagenes]
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Prov_d CHAR(16) = NULL ,
    @cCo_Prov_h CHAR(16) = NULL ,
    
	@cCo_Zona_d CHAR(6) = NULL ,
	@cCo_Zona_h CHAR(6) = NULL ,
	@cCo_Moneda CHAR(6) = NULL ,

	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @cStatus CHAR(6) = NULL ,
    @cAnulado CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)

-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, 'coti' AS tip_rep,
            P.prov_des, CP.cond_des, FC.doc_num, FC.nro_fact, FC.descrip, FC.co_prov, FC.co_mone, FC.co_cond,
			FC.fec_emis, FC.fec_venc, FC.fec_reg, FC.anulado, FC.rowguid,
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen, P.co_zon, FC.co_mone
        FROM
            saCotizacionProveedor AS FC
            INNER JOIN saProveedor AS P ON P.co_prov = FC.co_prov
            LEFT JOIN saCondicionPago AS CP ON CP.co_cond = FC.co_cond
			left outer join saDocumentoImagen DI 
			INNER JOIN saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON FC.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
            ( ( @cCo_Numero_d IS NULL
                OR FC.doc_num >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR FC.doc_num <= @cCo_Numero_h
                  )
            )
            AND ( ( @sCo_fecha_d IS NULL
                    OR dbo.FechaSimple(FC.fec_emis) >= @sCo_fecha_d
                  )
                  AND ( @sCo_fecha
```
