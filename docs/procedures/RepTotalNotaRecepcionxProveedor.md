# SP: RepTotalNotaRecepcionxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Notas de Recepcion por Proveedor>
-- =============================================
CREATE PROCEDURE [RepTotalNotaRecepcionxProveedor]
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

        SET @sOperacion = 'Nota de Recepción'

        SELECT
            @sOperacion AS Operacion, NR.doc_num, NR.descrip, NR.co_prov, NR.co_mone, NR.co_cond, NR.fec_emis,
            NR.fec_venc, NR.fec_reg, NR.anulado, NR.status, NR.n_control, NR.tasa, NR.porc_desc_glob, NR.monto_desc_glob,
            NR.porc_reca, NR.monto_reca, NRR.monto_imp, NR.monto_imp2, NR.monto_imp3, NRR.otros1, NRR.otros2, NRR.otros3,
            NR.total_neto, NR.saldo, NR.dir_ent, NR.comentario, NR.dis_cen, NR.feccom, NR.numcom, NR.impresa,
            NR.seriales_e, NR.salestax, NR.campo1, NR.campo2, NR.campo3, NR.campo4, NR.campo5, NR.campo6, NR.campo7,
            NR.campo8, NR.co_us_in, NR.co_sucu_in, NR.fe_us_in, NR.co_us_mo, NR.co_sucu_mo, NR.fe_us_mo, NR.revisado,
            NR.trasnfe, NR.validador, NR.rowguid, NRR.coti, P.prov_des,
            ROUND(( NRR.cost_vta - NRR.monto_desc - NRR.monto_desc_glob + NRR.monto_reca_glob ), 2) AS total_bruto	
        FROM
            saNotaRecepcionCompra AS NR 
            INNER JOIN ( SELECT DISTINCT
                            doc_num, SUM(total_art) AS total_art, SUM(cost_unit * total_art) AS cost_vta,
                            SUM(monto_imp) + SUM(monto_imp_afec_glob) AS monto_imp, SUM(monto_desc) AS monto_desc,
                            SUM(monto_desc_glob) AS monto_desc_glob, SUM(monto_reca_glob) AS monto_reca_glob,
                            SUM(pendiente) AS pendiente, SUM(otros1_glob) AS otr
```
