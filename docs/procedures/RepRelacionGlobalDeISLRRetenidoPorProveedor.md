# SP: RepRelacionGlobalDeISLRRetenidoPorProveedor
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoRentenReng`](../tables/saPagoRentenReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:        SOFTECH SISTEMAS
-- Create date: <10-26-2010>
-- Description:   <Relación Global de ISLR Retenido por Proveedor>
-- =============================================
CREATE PROCEDURE [RepRelacionGlobalDeISLRRetenidoPorProveedor]
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
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
            P.rif, P.co_prov, P.prov_des, SUM(PR.monto_obj) AS monto_obj, SUM(PR.monto_reten) AS monto_reten
        FROM
            saProveedor P
            INNER JOIN saPago PA ON P.co_prov = PA.co_prov
            INNER JOIN saPagoTPReng PT ON PT.cob_num = PA.cob_num
            INNER JOIN saPagoDocReng PD ON PD.cob_num = PT.cob_num
                                           AND PD.co_tipo_doc = 'ISLR'
            INNER JOIN saPagoRentenReng PR ON PD.rowguid = PR.rowguid_reng_cob
        WHERE
            ( ( @dFecha_d IS NULL
                OR dbo.FechaSimple(PA.fecha) >= @dFecha_d
              )
              AND ( @dFecha_h IS NULL
                    OR dbo.FechaSimple(PA.fecha) <= @dFecha_h
                  )
            )
            AND ( ( @sCo_Prov_d IS NULL
                    OR PA.co_prov >= @sCo_Prov_d
                  )
                  AND ( @sCo_Prov_h IS NULL
                        OR PA.co_prov <= @sCo_Prov_h
                      )
                )
            AND ( PA.anulado = 0 )
        GROUP BY
            P.co_prov, P.rif, P.prov_des
        ORDER BY
            P.co_prov
      
      
    END
```
