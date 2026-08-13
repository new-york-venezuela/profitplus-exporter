# SP: RepTotalNotaEntregaxVendedor
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saNotaEntregaVenta`](../tables/saNotaEntregaVenta.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Notas de Entrega por Vendedor>
-- =============================================
CREATE PROCEDURE [RepTotalNotaEntregaxVendedor]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
    @cCo_Vendedor_d CHAR(6) = NULL ,
    @cCo_Vendedor_h CHAR(6) = NULL ,
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

        SET @sOperacion = 'Nota de Entrega'

        SELECT
            @sOperacion AS Operacion, NE.doc_num, NE.descrip, NE.co_cli, NE.co_tran, NE.co_mone, NE.co_ven, NE.co_cond,
            NE.fec_emis, NE.fec_venc, NE.fec_reg, NE.anulado, NE.status, NE.n_control, NE.ven_ter, NE.tasa,
            NE.porc_desc_glob, NE.monto_desc_glob, NE.porc_reca, NE.monto_reca, NER.monto_imp, NE.monto_imp2,
            NE.monto_imp3, NER.otros1, NER.otros2, NER.otros3, NE.total_neto, NE.saldo, NE.dir_ent, NE.comentario,
            NE.dis_cen, NE.feccom, NE.numcom, NE.contrib, NE.impresa, NE.seriales_s, NE.salestax, NE.impfis,
            NE.impfisfac, NE.campo1, NE.campo2, NE.campo3, NE.campo4, NE.campo5, NE.campo6, NE.campo7, NE.campo8,
            NE.co_us_in, NE.co_sucu_in, NE.fe_us_in, NE.co_us_mo, NE.co_sucu_mo, NE.fe_us_mo, NE.revisado, NE.trasnfe,
            NE.validador, NE.rowguid, V.ven_des, NER.total_art, NER.coti, NER.monto_desc,
            NER.monto_desc_glob, NER.pendiente,
            ROUND(( NER.prec_vta - NER.monto_desc - NER.monto_desc_glob + NER.monto_reca_glob ), 2) AS total_bruto
        FROM
            saNotaEntregaVenta AS NE --INNER JOIN saNotaEntregaVentaReng AS NER ON NER.doc_num = NE.doc_num
            INNER JOIN ( SELECT DISTINCT
                            co_art, doc_num, SUM(total_art) AS total_art, SUM(prec_vta * total_art) AS prec_vta,
                            SUM(monto_imp) + SUM(monto_imp_afec_glob) AS monto_imp, SUM(monto_desc) AS monto_desc,
                            SUM(monto_desc_glob) AS monto_desc_glob, SUM(monto_reca_glob) AS monto_re
```
