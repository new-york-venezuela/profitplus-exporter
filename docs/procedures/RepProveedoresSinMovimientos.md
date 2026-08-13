# SP: RepProveedoresSinMovimientos
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <10-08-2010>
-- Description:	<Proveedores sin Movimientos>
-- =============================================
CREATE PROCEDURE [RepProveedoresSinMovimientos]
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
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
            P.co_prov, P.prov_des, ( dbo.SaldoProveedorAUnaFecha(P.co_prov, @dFecha_d - 1) ) AS saldo
        FROM
            saProveedor P
        WHERE
            P.co_prov NOT IN ( SELECT
                                co_prov
                               FROM
                                saDocumentoCompra
                               WHERE
                                ( ( @dFecha_d IS NULL
                                    OR dbo.FechaSimple(fec_emis) >= @dFecha_d
                                  )
                                  AND ( @dFecha_h IS NULL
                                        OR dbo.FechaSimple(fec_emis) <= @dFecha_h
                                      )
                                )
                                AND ( @sCo_Moneda IS NULL
                                      OR @sCo_Moneda = co_mone
                                    )
                                AND ( @sCo_Sucursal IS NULL
                                      OR co_sucu_in = @sCo_Sucursal
                                    )
                                AND ( anulado = 0 ) )
            AND ( ( @sCo_Prov_d IS NULL
                    OR P.co_prov >= @sCo_Prov_d
                  )
                  AND ( @sCo_Prov_h IS NULL
                        OR P.co_prov <= @sCo_Prov_h
                      )
                )
        GROUP BY
            P.co_prov, P.prov_des
        ORDER BY
            P.co_prov

    END
```
