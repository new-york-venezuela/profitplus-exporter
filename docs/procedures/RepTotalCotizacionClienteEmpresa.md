# SP: RepTotalCotizacionClienteEmpresa
**Tipo**: Reporte
**Módulo**: Ventas

## Tablas Referenciadas
- [`saCotizacionCliente`](../tables/saCotizacionCliente.md)
- [`saCotizacionClienteReng`](../tables/saCotizacionClienteReng.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10/08/2010>
-- Description:	<Reporte de Total de Cotizaciones de la Empresa>
-- =============================================
CREATE PROCEDURE [RepTotalCotizacionClienteEmpresa]
    @sCo_fecha_d SMALLDATETIME = NULL ,
    @sCo_fecha_h SMALLDATETIME = NULL ,
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

        SET @sOperacion = 'Cotización'

        SELECT
            @sOperacion AS Operacion, CC.doc_num, CC.descrip, CC.co_cli, CC.co_tran, CC.co_mone, CC.co_ven, CC.co_cond,
            CC.fec_emis, CC.fec_venc, CC.fec_reg, CC.anulado, CC.status, CC.n_control, CC.ven_ter, CC.tasa,
            CC.porc_desc_glob, CC.monto_desc_glob, CC.porc_reca, CC.monto_reca, CCR.monto_imp, CC.monto_imp2,
            CC.monto_imp3, CCR.otros1, CCR.otros2, CCR.otros3, CC.total_neto, CC.saldo, CC.dir_ent, CC.comentario,
            CC.dis_cen, CC.feccom, CC.numcom, CC.contrib, CC.impresa, CC.seriales_s, CC.salestax, CC.impfis,
            CC.impfisfac, CC.campo1, CC.campo2, CC.campo3, CC.campo4, CC.campo5, CC.campo6, CC.campo7, CC.campo8,
            CC.co_us_in, CC.co_sucu_in, CC.fe_us_in, CC.co_us_mo, CC.co_sucu_mo, CC.fe_us_mo, CC.revisado, CC.trasnfe,
            CC.validador, CC.rowguid, CCR.total_art, CCR.coti, CCR.monto_desc, CCR.monto_desc_glob, CCR.pendiente,
            RTRIM(RTRIM(LTRIM(CAST(DATEPART(MONTH, CC.fec_emis) AS CHAR(2)))) + '/'
                  + CAST(DATEPART(year, CC.fec_emis) AS CHAR(4))) AS fecha,
            ROUND(( CCR.prec_vta - CCR.monto_desc - CCR.monto_desc_glob + CCR.monto_reca_glob ), 2) AS total_bruto
        FROM
            saCotizacionCliente AS CC
            INNER JOIN ( SELECT
                            doc_num, SUM(total_art) AS total_art, SUM(prec_vta * total_art) AS prec_vta,
                            SUM(monto_imp) + SUM(monto_imp_afec_glob) AS monto_imp, SUM(monto_desc) AS monto_desc,
                            SUM(monto_desc_glob) AS monto_desc_glob, SUM(monto_reca_glob) AS monto_reca_glob,
```
