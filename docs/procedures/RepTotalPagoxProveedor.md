# SP: RepTotalPagoxProveedor
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <17/08/2010>
-- Description:	<Reporte de Total de Pagos por Proveedor>
-- =============================================
CREATE PROCEDURE [RepTotalPagoxProveedor]
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

        SELECT
            ISNULL(A.co_prov, B.co_prov) AS co_prov, ISNULL(A.prov_des, B.prov_des) AS prov_des,
            ISNULL(A.anho_compra, B.anho_pago) AS anho, ISNULL(A.mes_compra, B.mes_pago) AS mes,
            ISNULL(A.total_compra, 0) AS total_compra, ISNULL(B.total_EF, 0) AS total_EF,
            ISNULL(B.total_CH, 0) AS total_CH, ISNULL(B.total_TR, 0) AS total_TR
        FROM
            ( SELECT
                P.co_prov, P.prov_des, TCOMPRAS.anho_compra, TCOMPRAS.mes_compra, TCOMPRAS.total_compra
              FROM
                saProveedor P
                INNER JOIN ( SELECT
                                DC.co_prov, YEAR(DC.fec_emis) AS anho_compra, MONTH(DC.fec_emis) AS mes_compra,
                                SUM(DC.total_neto) AS total_compra
                             FROM
                                saDocumentoCompra DC
                             WHERE
                                DC.anulado = 0
                                AND DC.co_tipo_doc = 'FACT'
                                AND ( @sCo_fecha_d IS NULL
                                      OR dbo.FechaSimple(DC.fec_emis) >= @sCo_fecha_d
                                    )
                                AND ( @sCo_fecha_h IS NULL
                                      OR dbo.FechaSimple(DC.fec_emis) <= @sCo_fecha_h
                                    )
                                AND ( @cCo_Moneda IS NULL
```
