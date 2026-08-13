# SP: RepTotalOrdenCompraxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saOrdenCompra`](../tables/saOrdenCompra.md)
- [`saOrdenCompraReng`](../tables/saOrdenCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Ordenes de Compra por Proveedor>
-- =============================================
CREATE PROCEDURE [RepTotalOrdenCompraxProveedor]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Zona_d CHAR(6) = NULL ,
    @sCo_Zona_h CHAR(6) = NULL ,
    @sCo_Segmento_d CHAR(6) = NULL ,
    @sCo_Segmento_h CHAR(6) = NULL ,
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

        SET @sOperacion = 'Orden de Compra'

        SELECT
            @sOperacion AS Operacion, OC.doc_num, OC.descrip, OC.co_prov, OC.co_mone, OC.co_cond, OC.fec_emis,
            OC.fec_venc, OC.fec_reg, OC.anulado, OC.status, OC.n_control, OC.tasa, OC.porc_desc_glob, OC.monto_desc_glob,
            OC.porc_reca, OC.monto_reca, OCR.monto_imp, OC.monto_imp2, OC.monto_imp3, OCR.otros1, OCR.otros2, OCR.otros3,
            OC.total_neto, OC.saldo, OC.dir_ent, OC.comentario, OC.dis_cen, OC.feccom, OC.numcom, OC.impresa,
            OC.seriales_e, OC.salestax, OC.campo1, OC.campo2, OC.campo3, OC.campo4, OC.campo5, OC.campo6, OC.campo7,
            OC.campo8, OC.co_us_in, OC.co_sucu_in, OC.fe_us_in, OC.co_us_mo, OC.co_sucu_mo, OC.fe_us_mo, OC.revisado,
            OC.trasnfe, OC.validador, OC.rowguid, OCR.coti, P.prov_des,
            ROUND(( OCR.cost_vta - OCR.monto_desc - OCR.monto_desc_glob + OCR.monto_reca_glob ), 2) AS total_bruto
        FROM
            saOrdenCompra AS OC
            INNER JOIN ( SELECT DISTINCT
                            doc_num, SUM(total_art) AS total_art, SUM(cost_unit * total_art) AS cost_vta,
                            SUM(monto_imp) + SUM(monto_imp_afec_glob) AS monto_imp, SUM(monto_desc) AS monto_desc,
                            SUM(monto_desc_glob) AS monto_desc_glob, SUM(monto_reca_glob) AS monto_reca_glob,
                            SUM(pendiente) AS pendiente, SUM(otros1_glob) AS otros1, SUM(otros2
```
