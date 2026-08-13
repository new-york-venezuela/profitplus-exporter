# SP: RepDocumentoCXPxNumero
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <02-08-10>
-- Modified date: <2017-10-27>
-- Description:	<Documentos de Compra por Numero>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoCXPxNumero]
	-- Add the parameters for the stored procedure here
    @sNum_doc_d CHAR(20) = NULL ,
    @sNum_doc_h CHAR(20) = NULL ,
    @sCo_Tip CHAR(6) = NULL ,
    @dFecha_Emis_d DATETIME = NULL ,
    @dFecha_Emis_h DATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Condic CHAR(4) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
	@sCo_Moneda_Rep CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'num_doc'


        IF @dFecha_Emis_h IS NOT NULL 
            SET @dFecha_Emis_h = DATEADD(ss, -60, DATEADD(day, 1, @dFecha_Emis_h))

        DECLARE @fechadiff INT ;
        SET @fechadiff = DATEDIFF(dd, 00, GETDATE()) ;

		Declare @MonedaBase char(6)
		Select @MonedaBase = g_moneda from par_emp

		if (@sCo_Moneda_Rep is null)
			set @sCo_Moneda_Rep = @MonedaBase    

        SELECT
            DC.nro_doc, DC.co_tipo_doc, DC.nro_fact, DC.co_prov, DC.fec_emis, DC.fec_venc, DC.anulado, DC.otros1,
            DC.otros2, DC.otros3, 
			DC.total_neto * ( CASE WHEN DC.anulado = 1 THEN 0 ELSE 1 END ) AS total_neto,
            DC.saldo * ( CASE WHEN DC.anulado = 1 THEN 0 ELSE 1 END ) AS saldo, 
			CASE	
				WHEN @sCo_Moneda_Rep = @MonedaBase THEN 1 
				WHEN @sCo_Moneda_Rep = DC.co_mone THEN DC.tasa 
				ELSE [dbo].[TasaAUnaFecha](@sCo_Moneda_Rep, 0, DC.fec_emis)  
			END AS tasa, 
			DC.tasa as tasa_doc, DC.co_mone as co_mone_doc, 
			@sCo_Moneda_Rep as Mon_Rep, @sCo_Moneda as Mon_Fil,
			MN.relacion as Rel_Inv,
			DC.total_bruto, DC.monto_imp, P.prov_des, TP.descrip,
            TP.tipo_mov
        FROM
            saDocumentoCompra AS DC
            INNER JOIN saProveedor AS P ON P.co_prov = DC.co_prov
			INNER JOIN saMoneda AS MN ON MN.co_mone = DC.co_mone
            LEFT JOIN saTipoDocumento AS TP ON TP.c
```
