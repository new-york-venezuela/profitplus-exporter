# SP: RepProveedorDatosBasicos
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-07-10>
-- Description:	<Proveedores con Datos Básicos>
-- =============================================
CREATE PROCEDURE [RepProveedorDatosBasicos]
	-- Add the parameters for the stored procedure here
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_TipPro_d CHAR(6) = NULL ,
    @sCo_TipPro_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Nacional CHAR(2) = NULL ,
    @sCo_Inactivo CHAR(2) = NULL ,
    @bCo_Inactivo_Filtro BIT = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sCo_Inactivo = 'SI' ) 
            SET @bCo_Inactivo_Filtro = 1
        IF ( @sCo_Inactivo = 'NO' ) 
            SET @bCo_Inactivo_Filtro = 0


        SELECT
            P.*, TP.des_tipo
        FROM
            saProveedor AS P
            INNER JOIN saTipoProveedor AS TP ON TP.tip_pro = P.tip_pro
        WHERE
            ( ( @sCo_Prov_d IS NULL
                OR P.co_prov >= @sCo_Prov_d
              )
              AND ( @sCo_Prov_h IS NULL
                    OR P.co_prov <= @sCo_Prov_h
                  )
            )
            AND ( ( @sCo_TipPro_d IS NULL
                    OR P.tip_pro >= @sCo_TipPro_d
                  )
                  AND ( @sCo_TipPro_h IS NULL
                        OR P.tip_pro <= @sCo_TipPro_h
                      )
                )
            AND ( ( @sCo_Zon_d IS NULL
                    OR P.co_zon >= @sCo_Zon_d
                  )
                  AND ( @sCo_Zon_h IS NULL
                        OR P.co_zon <= @sCo_Zon_h
                      )
                )
            AND ( ( @sCo_Seg_d IS NULL
                    OR P.co_seg >= @sCo_Seg_d
                  )
                  AND ( @sCo_Seg_h IS NULL
                        OR P.co_seg <= @sCo_Seg_h
                      )
                )
            AND ( @sCo_Nacional IS NULL
                  OR ( @sCo_Nacional = 'SI'
                       AND P.nacional = 1
                     )
                  OR ( @sCo_Nacional = 'NO'
                       AND P.nacional = 0
                     )
                )
            AND ( @bCo_Ina
```
