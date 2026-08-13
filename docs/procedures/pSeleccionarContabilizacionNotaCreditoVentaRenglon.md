# SP: pSeleccionarContabilizacionNotaCreditoVentaRenglon
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/09/2010>
-- Last Update: 2017-08-03
-- Description:	<pSeleccionarContabilizacionNotaCreditoVentaRenglon>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarContabilizacionNotaCreditoVentaRenglon]
    (
      @sCo_Doc_Padre CHAR(20) = NULL ,
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
	 
		SELECT     DV.nro_doc AS Co_Doc_Padre, DVR.reng_num AS Co_Doc, CASE WHEN DV.fec_emis > DV.fec_reg THEN DV.fec_emis ELSE DV.fec_reg END as fec_Emis, MO.relacion AS mone_relacion, CL.co_cli AS Co_Auxiliar, CL.cli_des AS Descrip_Auxiliar, 
                      DVR.co_sucu_in AS Co_Sucu_Cont, DVR.co_art, DVR.des_art, DVR.co_alma, DVR.total_art, DVR.prec_vta, DVR.porc_desc, DVR.monto_desc, DVR.tipo_imp, 
                      DVR.tipo_imp2, DVR.tipo_imp3, DVR.porc_imp, DVR.porc_imp2, DVR.porc_imp3, DVR.monto_imp, DVR.monto_imp2, DVR.monto_imp3, DVR.reng_neto, 
                      DVR.co_tipo_doc, DVR.nro_doc, DVR.rowguid, DVR.otros, DVR.dis_cen AS dis_cen_saDocumentoVentaReng, DVR.co_us_in, DVR.co_sucu_in, DVR.co_us_mo, 
                      DVR.co_sucu_mo, DVR.revisado, DVR.rowguid AS Expr1, AR.dis_cen AS dis_cen_saArticulo, DV.co_mone, CL.cli_des AS des_cliente, CL.co_cli AS Co_Cliente, 
                      DV.tasa, ca.dis_cen AS dis_cen_saCatArticulo, li.dis_cen AS dis_cen_saLineaArticulo
		FROM         dbo.saDocumentoVentaReng AS DVR INNER JOIN
                      dbo.saDocumentoVenta AS DV ON DVR.nro_doc = DV.nro_doc AND DVR.co_tipo_doc = DV.co_tipo_doc INNER JOIN
                      dbo.saMoneda AS MO ON DV.co_mone = MO.co_mone LEFT OUTER JOIN
                      dbo.saCliente AS CL ON DV.co_cli = CL.co_cli INNER JOIN
                      dbo.saArticulo AS AR ON DVR.co_art = AR.co_art INNER JOIN
                      dbo.saCatArticulo AS ca ON AR.co_cat = ca.co_cat INNER JOIN
                      dbo.saLineaArticulo AS li ON AR.co_lin = li.co_lin        
        WHERE
			DVR.nro_doc = @sCo_Doc_Padre
			AND DVR.co_tipo_doc = 'N/CR'
        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
