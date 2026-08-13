# SP: RepPedidoVentaConImagenes
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saPedidoVenta`](../tables/saPedidoVenta.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <08/12/2014>
-- Description:	<Reporte de Notas de Pedidos de Venta por Renglones Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepPedidoVentaConImagenes] 
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @dCo_fecha_d SMALLDATETIME = NULL ,
    @dCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_cliente_d CHAR(16) = NULL ,
    @cCo_cliente_h CHAR(16) = NULL ,
    @cCo_Vendedor_d CHAR(6) = NULL ,
    @cCo_Vendedor_h CHAR(6) = NULL ,
    @cCo_Transporte_d CHAR(6) = NULL ,
    @cCo_Transporte_h CHAR(6) = NULL ,
    @cCo_Zona_d CHAR(6) = NULL ,
    @cCo_Zona_h CHAR(6) = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @cCo_Moneda CHAR(6) = NULL ,
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
            @cAnulado AS Filtro_anulado, 'PED' AS tipo_rep, CLI.tip_cli, CLI.cli_des, CLI.co_zon,
			FV.doc_num, FV.descrip, FV.co_cli, FV.co_tran, FV.co_mone, FV.co_ven, FV.co_cond,
            FV.fec_emis, FV.fec_venc, FV.fec_reg, FV.anulado, FV.rowguid,
			  DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen, VE.ven_des, TR.des_tran, CON.cond_des
        FROM
            saPedidoVenta AS FV
            INNER JOIN saCliente AS CLI ON CLI.co_cli = FV.co_cli
			INNER JOIN saVendedor AS VE ON VE.co_ven = FV.co_ven
			INNER JOIN saTransporte AS TR ON TR.co_tran = FV.co_tran
			INNER JOIN saCondicionPago AS CON ON CON.co_cond = FV.co_cond
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON FV.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
            (
```
