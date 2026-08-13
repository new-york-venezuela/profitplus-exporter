# SP: RepFormatoFacturaVentaNotaSeriales
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Consultores C.A.>
-- Create date: <15-07-2016>
-- Description:	<Reporte Formato Nota de Seriales de Factura de Venta>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoFacturaVentaNotaSeriales]
	-- Add the parameters for the stored procedure here
	@cDoc_Num_d CHAR(20) = NULL ,
	@cDoc_Num_h CHAR(20) = NULL ,
	@cCo_Sucu CHAR(6) = NULL ,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
	SELECT
		/*Campos saFacturaVenta*/ 
		FV.doc_num, FV.co_mone, FV.fec_emis, FV.fec_venc, FV.descrip, ISNULL(FV.dir_ent, CLI.dir_ent2) AS dir_ent,
		/*Campos saFacturaVentaReng*/
		FVR.co_alma, FVR.total_art, FVR.co_uni, FVR.reng_num,
		/*Campos saCliente*/
		CLI.co_cli, CLI.cli_des, CLI. rif, CLI.telefonos, CLI.direc1,
		/*Campos saTransporte*/
		TRA.co_tran, TRA.des_tran,
		/*Campos saVendedor*/
		VEN.co_ven, VEN.ven_des,
		/*Campos saCondicionPago*/
		CON.cond_des,
		/*Campos saArticulo*/
		ART.co_art, ART.art_des, ART.modelo,
		/*Campos saSeriales*/
		--STUFF((SELECT '          ' + [serial] FROM saSeriales WHERE doc_num_s = FVR.rowguid FOR XML PATH('')), 1, 1,'') AS serial
		STUFF((SELECT '         ' + [serial] + REPLICATE (' ', 40 - LEN([serial])) FROM saSeriales WHERE doc_num_s = FVR.rowguid FOR XML PATH('')), 1, 1,'') AS serial

	FROM saFacturaVenta AS FV
		INNER JOIN saFacturaVentaReng AS FVR ON FV.doc_num = FVR.doc_num
		INNER JOIN saCliente AS CLI ON FV.co_cli = CLI.co_cli
		INNER JOIN saTransporte AS TRA ON FV.co_tran = TRA.co_tran
		INNER JOIN saVendedor AS VEN ON FV.co_ven = VEN.co_ven
		INNER JOIN saCondicionPago AS CON ON FV.co_cond = CON.co_cond
		INNER JOIN saArticulo AS ART ON FVR.co_art = ART.co_art
		LEFT JOIN saSeriales AS SER ON FVR.rowguid = SER.doc_num_s AND SER.doc_tip_s = 'FACT'

	WHERE
		((@cDoc_Num_d IS NULL) OR
		((@cDoc_Num_d <= FV.doc_num) AND
		(FV.doc_num <= @cDoc_Num_h))) AND
		((@cCo_Sucu IS NULL) OR
		(FV.co_sucu_in = @cCo_Sucu))
	
	ORDER BY
		FV.doc_num, FVR.co_art ASC

END
```
