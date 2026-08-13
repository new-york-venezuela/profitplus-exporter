# SP: RepChequeDevVentaConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saChequeDevueltoVenta`](../tables/saChequeDevueltoVenta.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <21/01/2015>
-- Description:	<Generar cheque devuelto venta con imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepChequeDevVentaConImagenes]
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
	@sCo_cli_d CHAR(16) = NULL ,
    @sCo_cli_h CHAR(16) = NULL ,
	@sCo_cta_d CHAR(6) = NULL ,
    @sCo_cta_h CHAR(6) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCo_Sucu CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

				Select CD.co_cheq_dev, CD.des_cheq_dev, P.co_cli, CD.fecha, CD.num_doc, CD.cod_cta, CB.num_cta, CD.co_tipo_doc, 
				CD.nro_doc, CD.mont_doc, CD.fec_cheq, CD.co_ban, CD.procesado, P.cli_des, B.des_ban,DI.co_imag, 
				DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen, @sCo_cli_d
				From saChequeDevueltoVenta as CD 
					inner join saCuentaBancaria as CB on CB.cod_cta = CD.cod_cta
					right join saCliente as P on CD.co_cli = P.co_cli
					right join saBanco as B on CD.co_ban = B.co_ban
					left outer join saDocumentoImagen DI 
					inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON CD.rowguid = DI.rowguidDoc
				WHERE
					DI.co_imag is not null and 
					((@cCo_Numero_d IS NULL OR CD.co_cheq_dev >= @cCo_Numero_d) AND (@cCo_Numero_h IS NULL OR CD.co_cheq_dev <= @cCo_Numero_h)) AND 
					((@sCo_cli_d IS NULL OR P.co_cli >= @sCo_cli_d) AND (@sCo_cli_h IS NULL OR P.co_cli <= @sCo_cli_h)) AND
					((@sCo_cta_d IS NULL OR CD.cod_cta >= @sCo_cta_d) AND (@sCo_cta_h IS NULL OR CD.cod_cta <= @sCo_cta_h)) AND
					((@dFecha_d IS NULL OR CD.fecha >= @dFecha_d) AND (@dFecha_h IS NULL OR CD.fecha <= @dFecha_h)) AND 
					(@sCo_Sucu IS NULL OR CD.co_sucu_in = @sCo_Sucu) AND
					((@sCo_tipo_img_d IS NULL OR TI.co_tipo_imag >= @sCo_tipo_img_d) AND (@sCo_tipo_img_h IS NULL OR TI.co_tipo_imag <= @sCo_tipo_img_h))                   
					
    END
```
