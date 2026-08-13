# SP: RepFormatoNotaDespachoNotaSeriales
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saNotaDespachoVenta`](../tables/saNotaDespachoVenta.md)
- [`saNotaDespachoVentaReng`](../tables/saNotaDespachoVentaReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Consultores C.A.>
-- Create date: <19-07-2016>
-- Description:	<Reporte Formato Nota de Seriales de Nota de Despacho>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoNotaDespachoNotaSeriales]
	-- Add the parameters for the stored procedure here
	@cDoc_Num_d CHAR(20) = NULL ,
	@cDoc_Num_h CHAR(20) = NULL ,
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
		/*Campos saNotaDespachoVenta*/ 
		NDV.doc_num, NDV.co_mone, NDV.fec_emis, NDV.fec_venc, NDV.descrip, ISNULL(NDV.dir_ent, CLI.dir_ent2) AS dir_ent,
		/*Campos saNotaDespachoVentaReng*/
		NDVR.co_alma, NDVR.total_art, NDVR.co_uni, NDVR.tipo_doc, NDVR.num_doc, NDVR.reng_num,
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
		--STUFF((SELECT '         ' + [serial] FROM saSeriales WHERE doc_num_s = NDVR.rowguid FOR XML PATH('')), 1, 1,'') AS serial
		STUFF((SELECT '         ' + [serial] + REPLICATE (' ', 40 - LEN([serial])) FROM saSeriales WHERE doc_num_s = NDVR.rowguid FOR XML PATH('')), 1, 1,'') AS serial

	FROM saNotaDespachoVenta AS NDV
		INNER JOIN saNotaDespachoVentaReng AS NDVR ON NDV.doc_num = NDVR.doc_num
		INNER JOIN saCliente AS CLI ON NDV.co_cli = CLI.co_cli
		INNER JOIN saTransporte AS TRA ON NDV.co_tran = TRA.co_tran
		INNER JOIN saVendedor AS VEN ON NDV.co_ven = VEN.co_ven
		INNER JOIN saCondicionPago AS CON ON NDV.co_cond = CON.co_cond
		INNER JOIN saArticulo AS ART ON NDVR.co_art = ART.co_art
		LEFT JOIN saSeriales AS SER ON NDVR.rowguid = SER.doc_num_s AND SER.doc_tip_s = 'NDES'

	WHERE
		((@cDoc_Num_d IS NULL) OR
		((@cDoc_Num_d <= NDV.doc_num) AND
		(NDV.doc_num <= @cDoc_Num_h)))
	
	ORDER BY
		NDV.doc_num, NDVR.co_art ASC

END
```
