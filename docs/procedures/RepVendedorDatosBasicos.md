# SP: RepVendedorDatosBasicos
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saVendedor`](../tables/saVendedor.md)
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-07-10>
-- Description:	<Vendedores con Datos Básicos>
-- =============================================
CREATE PROCEDURE [RepVendedorDatosBasicos]
       -- Add the parameters for the stored procedure here
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL,
    @sCo_Zon_h CHAR(6) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            VE.*, ZO.zon_des
        FROM
            saVendedor VE
                    LEFT JOIN saZona ZO ON VE.co_zon = ZO.co_zon
        WHERE
            ((@sCo_Ven_d IS NULL OR VE.co_ven >= @sCo_Ven_d) AND 
                           (@sCo_Ven_h IS NULL OR VE.co_ven <= @sCo_Ven_h))
            AND (@sCo_Sucursal IS NULL OR VE.co_sucu_in = @sCo_Sucursal)
                    AND ((@sCo_Zon_d IS NULL OR VE.co_zon >= @sCo_Zon_d) AND
                           (@sCo_Zon_h IS NULL OR VE.co_zon <= @sCo_Zon_h))
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'ven_des' THEN ven_des
                                 ELSE co_ven
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'ven_des' THEN ven_des
                                          ELSE co_ven
                                        END
                      END ASC
    END
```
