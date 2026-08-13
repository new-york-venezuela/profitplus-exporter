# SP: RepProveedorDatosCredito
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25-08-11>
-- Description:	<Proveedores con sus Datos de Crédito>
-- =============================================
CREATE PROCEDURE [RepProveedorDatosCredito]
	-- Add the parameters for the stored procedure here
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_TipPro_d CHAR(6) = NULL ,
    @sCo_TipPro_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Inactivo CHAR(4) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

/*********Valores por defecto*********/
IF @sCo_Inactivo IS NULL
	SET @sCo_Inactivo = 'TODO'



        SELECT
            co_prov, prov_des, mont_cre, plaz_pag, desc_ppago, desc_glob
        FROM
            saProveedor
            --INNER JOIN saTipoProveedor AS TP ON TP.tip_pro = P.tip_pro
        WHERE
            (( @sCo_Prov_d IS NULL
                OR co_prov >= @sCo_Prov_d
              )
              AND ( @sCo_Prov_h IS NULL
                    OR co_prov <= @sCo_Prov_h
                  )
            )
            AND (( @sCo_TipPro_d IS NULL
                    OR tip_pro >= @sCo_TipPro_d
                  )
                  AND ( @sCo_TipPro_h IS NULL
                        OR tip_pro <= @sCo_TipPro_h
                      )
                )
            AND (( @sCo_Zon_d IS NULL
                    OR co_zon >= @sCo_Zon_d
                  )
                  AND ( @sCo_Zon_h IS NULL
                        OR co_zon <= @sCo_Zon_h
                      )
                )
            AND (( @sCo_Seg_d IS NULL
                    OR co_seg >= @sCo_Seg_d
                  )
                  AND ( @sCo_Seg_h IS NULL
                        OR co_seg <= @sCo_Seg_h
                      )
                )
			AND (( @sCo_Inactivo = 'TODO' )
                  OR ( @sCo_Inactivo = 'SIT'
                       AND inactivo = 1
                     )
                  OR ( @sCo_Inactivo = 'NOT'
                       AND inactivo = 0
                     ))

        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'prov_des' THEN prov_des
                                 ELSE c
```
