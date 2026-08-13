# SP: RepCobrosConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <13-01-15>
-- Description:	<Cobros por Cliente con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepCobrosConImagenes]
 -- Add the parameters for the stored procedure here
    @sNum_pag_d CHAR(20) = NULL ,
    @sNum_pag_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sSubtotal CHAR(4) = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCondic CHAR(4) = NULL ,
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

        IF ( @sCondic = 'TDOA' ) 
            SET @sCondic = NULL
	
        IF ( @sCondic = 'SIA' ) 
            SET @sCondic = 1	

        IF ( @sCondic = 'NOA' ) 
            SET @sCondic = 0
	
        DECLARE @mone_base AS CHAR(2) 
        SELECT
            @mone_base = g_moneda
        FROM
            par_emp
	
        SELECT
            P.cob_num, P.fecha, P.co_cli, PV.cli_des, P.anulado, P.co_mone, PT.cod_caja, 
			PT.cod_caja,C.descrip, PT.cod_cta, CB.num_cta,
			DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen, 
			P.recibo, SUM(PT.mont_doc) as mont_doc
        FROM
            saCobro AS P
            RIGHT JOIN saCobroTPReng AS PT ON P.cob_num = PT.cob_num
            INNER JOIN saCliente AS PV ON P.co_cli = PV.co_cli
            LEFT JOIN saCaja AS C ON PT.cod_caja = C.cod_caja
            LEFT JOIN saCuentaBancaria AS CB ON PT.cod_cta = CB.cod_cta
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON P.rowguid = DI.rowguidDoc
        WHERE
			DI.co_imag is not null and
            (( @snum_pag_d IS NULL OR P.cob_num >= @snum_pag_d) AND (@snum_pag_h IS NULL OR P.cob_num <= @snum
```
