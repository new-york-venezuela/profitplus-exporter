# SP: RepNotaRecepcionConDevolucion
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDevolucionProveedor`](../tables/saDevolucionProveedor.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03-02-11>
-- Description:	<Notas de Recepcion con sus Devoluciones>
-- =============================================
CREATE PROCEDURE [RepNotaRecepcionConDevolucion]
	-- Add the parameters for the stored procedure here
    @sNumero_d CHAR(20) = NULL ,
    @sNumero_h CHAR(20) = NULL ,
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
    @sCo_mone CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF @dFecha_d IS NOT NULL 
            SET @dFecha_d = dbo.FechaSimple(@dFecha_d)
        IF @dFecha_h IS NOT NULL 
            SET @dFecha_h = dbo.FechaSimple(@dFecha_h)

        SELECT
            *
        FROM
            ( SELECT
                N.doc_num AS num_nota, N.doc_num AS num_doc, P.doc_num, N.fec_emis, P.fec_venc, P.co_mone, P.tasa,
                P.total_neto, P.co_prov, C.prov_des, 'Devolución' AS tip, N.total_neto AS neto, N.fec_emis AS fecha,
                PR.reng_neto, N.total_bruto AS bruto, N.tasa AS tasar, N.co_mone AS mone, P.co_sucu_in,
                'compra' AS tipox
              FROM
                saNotaRecepcionCompra AS P
                INNER JOIN saNotaRecepcionCompraReng AS CR ON P.doc_num = CR.doc_num
                                                              AND P.anulado = 0
                INNER JOIN ( SELECT
                                SUM(( PR.cost_unit * PR.total_art ) + PR.monto_imp + PR.monto_imp_afec_glob
                                    + PR.otros1_glob + PR.otros2_glob + PR.otros3_glob + -PR.monto_desc
                                    - PR.monto_desc_glob) AS reng_neto, PR.doc_num, PR.rowguid_doc
                             FROM
                                saDevolucionProveedorReng AS PR
                             WHERE
                                PR.tipo_doc = 'NREC'
                             GROUP BY
                                PR.doc_num, PR.rowguid_doc
                           ) AS PR ON CR.rowguid = PR.rowguid_doc
                INNER JOIN saDevolucionProveedor AS N ON PR.doc_num = N.doc_num
                INNER JOIN saProveedor AS C ON P.co_prov = C.co_prov
              WHERE
                N.anul
```
