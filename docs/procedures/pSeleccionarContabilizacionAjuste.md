# SP: pSeleccionarContabilizacionAjuste
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saMoneda`](../tables/saMoneda.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacionAjuste]
    (
      @sdFechaDesde DATETIME ,
      @sdFechHasta DATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
        SELECT
            AJ.ajue_num AS Co_Doc, AJ.fecha AS Fec_Emis, '' AS Co_Auxiliar, '' AS Descrip_Auxiliar, AJ.motivo,
            AJ.co_mone, AJ.tasa, AJ.seriales_s, AJ.seriales_e, AJ.feccom, AJ.numcom, AJ.co_invfisico, AJ.aux01, AJ.aux02,
            AJ.dis_cen AS dis_cen_saAjuste, AJ.campo1, AJ.campo2, AJ.campo3, AJ.campo4, AJ.campo5,
            AJ.co_sucu_in AS Co_Sucu_Cont, AJ.campo6, AJ.campo7, AJ.campo8, AJ.co_us_in AS Co_Sucu_Cont, AJ.co_sucu_in,
            AJ.fe_us_in, AJ.co_us_mo, AJ.co_sucu_mo, AJ.fe_us_mo, AJ.validador, AJ.rowguid, MO.mone_des
        FROM
            saAjuste AS AJ
            INNER JOIN saMoneda AS MO ON AJ.co_mone = MO.co_mone
        WHERE
            --(DATEDIFF(DAY, AJ.fecha , @sdFechaDesde) <= 0 AND DATEDIFF(DAY, AJ.fecha , @sdFechHasta) >= 0)
            ( ( @sdFechaDesde IS NULL
                OR dbo.FechaSimple(AJ.fecha) >= @sdFechaDesde
              )
              AND ( @sdFechHasta IS NULL
                    OR dbo.FechaSimple(AJ.fecha) <= @sdFechHasta
                  )
            )
            AND ( AJ.co_sucu_in >= @sCo_Sucu_Desde
                  OR @sCo_Sucu_Desde IS NULL
                )
            AND ( AJ.co_sucu_in <= @sCo_Sucu_Hasta
                  OR @sCo_Sucu_Hasta IS NULL
                )
            AND ( @bDocnoint = 0
                  OR ( @bDocnoint = 1
                       AND AJ.feccom IS NULL
                       AND AJ.numcom IS NULL
                     )
                )
            AND AJ.anulado = 0 --Sólo Documentos que no esten Anulados
        ORDER BY
            Fec_Emis ASC, Co_Doc ASC
    END
```
