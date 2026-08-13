# SP: RepTotalCotizacionClientexArticulo
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Cotizaciones por Artículo>
-- =============================================
CREATE PROCEDURE [RepTotalCotizacionClientexArticulo]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Linea_d CHAR(6) = NULL ,
    @sCo_Linea_h CHAR(6) = NULL ,
    @sCo_Sub_Linea_d CHAR(6) = NULL ,
    @sCo_Sub_Linea_h CHAR(6) = NULL ,
    @sCo_Categoria_d CHAR(6) = NULL ,
    @sCo_Categoria_h CHAR(6) = NULL ,
    @cCo_Moneda CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sOperacion CHAR(20) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @sCo_fecha_d IS NOT NULL 
            SET @sCo_fecha_d = dbo.FechaSimple(@sCo_fecha_d)
        IF @sCo_fecha_h IS NOT NULL 
            SET @sCo_fecha_h = dbo.FechaSimple(@sCo_fecha_h)

        SET @sOperacion = 'coti'

        SELECT
            @sOperacion AS Operacion, CC.doc_num, CC.descrip, CC.co_cli, CC.co_tran, CC.co_mone, CC.co_ven, CC.co_cond,
            CC.fec_emis, CC.fec_venc, CC.fec_reg, CC.anulado, CC.status, CC.n_control, CC.ven_ter, CC.tasa,
            CC.porc_desc_glob, CC.monto_desc_glob, CC.porc_reca, CC.monto_reca, CC.total_bruto, CCR.monto_imp,
            CC.monto_imp2, CC.monto_imp3, CCR.otros1, CCR.otros2, CCR.otros3, CC.total_neto, CC.saldo, CC.dir_ent,
            CC.comentario, CC.dis_cen, CC.feccom, CC.numcom, CC.contrib, CC.impresa, CC.seriales_s, CC.salestax,
            CC.impfis, CC.impfisfac, CC.campo1, CC.campo2, CC.campo3, CC.campo4, CC.campo5, CC.campo6, CC.campo7,
            CC.campo8, CC.co_us_in, CC.co_sucu_in, CC.fe_us_in, CC.co_us_mo, CC.co_sucu_mo, CC.fe_us_mo, CC.revisado,
            CC.trasnfe, CC.validador, CC.rowguid, CCR.co_art, AU.co_uni,
            ROUND(dbo.ArtUnidadBase(CCR.co_art, CCR.co_uni, CCR.total_art), 5) AS total_art,
            ROUND(dbo.ArtUnidadBase(CCR.co_art, CCR.co_uni, CCR.pendiente), 5) AS pendiente,
            ROUND(( CCR.cost_vta - CCR.monto_desc - CCR.monto_desc_glob + CCR.monto_reca_glob ), 2) AS monto_base,
            CCR.coti
        FROM
            saCotizacionCliente AS CC
            INNER JOIN ( SELECT /*distinct*/
                            doc_num, co_
```
