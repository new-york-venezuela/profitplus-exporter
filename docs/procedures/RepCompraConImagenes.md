# SP: RepCompraConImagenes
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saFacturaCompra`](../tables/saFacturaCompra.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25/08/2010>
-- Description:	<Reporte de Factura de Compra Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepCompraConImagenes] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
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
	
        IF @dCo_fecha_d IS NOT NULL 
            SET @dCo_fecha_d = dbo.FechaSimple(@dCo_fecha_d)
        IF @dCo_fecha_h IS NOT NULL 
            SET @dCo_fecha_h = dbo.FechaSimple(@dCo_fecha_h)


-- Insert statements for procedure here

-------------------------------
        IF ( @cStatus IS NULL ) 
            SET @cStatus = 'TODO'
        IF ( @cAnulado IS NULL ) 
            SET @cAnulado = 'TODO'
-------------------------------

        SELECT
            @cAnulado AS Filtro_anulado, 'compra' AS tip_rep,P.prov_des, CP.cond_des, FC.doc_num, FC.nro_fact, FC.descrip, 
			FC.co_prov, FC.co_mone, FC.co_cond, FC.anulado, FC.fec_emis, FC.fec_venc, FC.fec_reg, FC.rowguid,
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen, P.co_zon
        FROM
            saFacturaCompra AS FC
            INNER JOIN saProveedor AS P ON P.co_prov = FC.co_prov
            LEFT JOIN saCondicionPago AS CP ON CP.co_cond = FC.co_cond
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON FC.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
            ( ( @cCo_Numero_d IS NULL
                OR FC.doc_num >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR FC.doc_num <= @cCo_Numero_h
                  )
            )
            AND ( ( @dCo_fecha_d IS NULL
                    OR dbo.FechaSimple(FC.fec_emis) >= @dCo_fecha_d
```
