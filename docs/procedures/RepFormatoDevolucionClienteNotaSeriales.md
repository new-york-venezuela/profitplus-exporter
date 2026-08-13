# SP: RepFormatoDevolucionClienteNotaSeriales
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saDevolucionCliente`](../tables/saDevolucionCliente.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saSeriales`](../tables/saSeriales.md)
- [`saTransporte`](../tables/saTransporte.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Consultores C.A.>
-- Create date: <19-07-2016>
-- Description:	<Reporte Formato Nota de Seriales de Devolución de Cliente>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoDevolucionClienteNotaSeriales]
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
		/*Campos saDevolucionCliente*/ 
		DC.doc_num, DC.co_mone, DC.fec_emis, DC.fec_venc, DC.descrip, ISNULL(DC.dir_ent, CLI.dir_ent2) AS dir_ent,
		/*Campos saDevolucionClienteReng*/
		DCR.co_alma, DCR.total_art, DCR.co_uni, DCR.tipo_doc, DCR.num_doc, DCR.reng_num,
		/*Campos saCliente*/
		CLI.co_cli, CLI.cli_des, CLI.rif, CLI.telefonos, CLI.direc1,
		/*Campos saTransporte*/
		TRA.co_tran, TRA.des_tran,
		/*Campos saVendedor*/
		VEN.co_ven, VEN.ven_des,
		/*Campos saCondicionPago*/
		CON.cond_des,
		/*Campos saArticulo*/
		ART.co_art, ART.art_des, ART.modelo,
		/*Campos saSeriales*/
		--STUFF((SELECT '          ' + [serial] FROM saSeriales WHERE doc_num_e = DCR.rowguid FOR XML PATH('')), 1, 1,'') AS serial
		STUFF((SELECT '         ' + [serial] + REPLICATE (' ', 40 - LEN([serial])) FROM saSeriales WHERE doc_num_e = DCR.rowguid FOR XML PATH('')), 1, 1,'') AS serial

	FROM saDevolucionCliente AS DC
		INNER JOIN saDevolucionClienteReng AS DCR ON DC.doc_num = DCR.doc_num
		INNER JOIN saCliente AS CLI ON DC.co_cli = CLI.co_cli
		INNER JOIN saTransporte AS TRA ON DC.co_tran = TRA.co_tran
		INNER JOIN saVendedor AS VEN ON DC.co_ven = VEN.co_ven
		INNER JOIN saCondicionPago AS CON ON DC.co_cond = CON.co_cond
		INNER JOIN saArticulo AS ART ON DCR.co_art = ART.co_art
		LEFT JOIN saSeriales AS SER ON DCR.rowguid = SER.doc_num_e AND SER.doc_tip_e = 'DCLI'

	WHERE
		((@cDoc_Num_d IS NULL) OR
		((@cDoc_Num_d <= DC.doc_num) AND
		(DC.doc_num <= @cDoc_Num_h)))
	
	ORDER BY
		DC.doc_num, DCR.co_art ASC

END
```
