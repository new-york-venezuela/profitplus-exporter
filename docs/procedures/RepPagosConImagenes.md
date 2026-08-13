# SP: RepPagosConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <28-09-10>
-- Description:	<Pagos con Imagenes>
-- =============================================
CREATE PROCEDURE  [dbo].[RepPagosConImagenes]
	-- Add the parameters for the stored procedure here
    @sNum_pag_d CHAR(20) = NULL ,
    @sNum_pag_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sSubtotal CHAR(4) = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCondic CHAR(2) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
 
        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)


        IF @sSubtotal = 'Si'
            OR @sSubtotal IS NULL 
            SET @sSubtotal = 'Si'
        ELSE 
            SET @sSubtotal = 'No'

        IF ( @sCondic = 'TD' ) 
            SET @sCondic = NULL
	
        IF ( @sCondic = 'SI' ) 
            SET @sCondic = 1	

        IF ( @sCondic = 'NO' ) 
            SET @sCondic = 0
	
        DECLARE @mone_base AS CHAR(2) 
        SELECT
            @mone_base = g_moneda
        FROM
            par_emp
	
        SELECT
            P.cob_num, P.fecha, P.descrip, P.co_prov, PV.prov_des, P.anulado, P.co_mone,
			C.descrip, DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, 
			TI.descrip as descripImagen, P.recibo, SUM(PT.mont_doc) as mont_doc
        FROM
            saPago AS P
            RIGHT JOIN saPagoTPReng AS PT ON P.cob_num = PT.cob_num
            INNER JOIN saProveedor AS PV ON P.co_prov = PV.co_prov
            LEFT JOIN saCaja AS C ON PT.cod_caja = C.cod_caja
            LEFT JOIN saCuentaBancaria AS CB ON PT.cod_cta = CB.cod_cta
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON P.rowguid = DI.rowguidDoc
        WHERE
			DI.co_imag is not null and
            ((@snum_pag_d IS NULL OR P.cob_num >= @snum_pag_d) AND (@snum_pag_h IS NULL OR P.cob_num <= @snum_pag_h)) AND
			((@dFecha_d IS NULL OR dbo.FechaSimple(P.fecha) >= @dFecha_d) AND (@dFecha_h IS NULL OR dbo.FechaSimple(
```
