# SP: RepTipoProveedor
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <11-03-10>
-- Description:	<Listado de Tipos de Proveedores>
-- =============================================
CREATE PROCEDURE [RepTipoProveedor]
	-- Add the parameters for the stored procedure here
    @sCo_TProv_d CHAR(6) = NULL ,
    @sCo_TProv_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            *
        FROM
            saTipoProveedor
        WHERE
            ( ( @sCo_TProv_d IS NULL
                OR @sCo_TProv_d <= tip_pro
              )
              AND ( @sCo_TProv_h IS NULL
                    OR tip_pro <= @sCo_TProv_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tipo' THEN des_tipo
                                 ELSE tip_pro
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tipo' THEN des_tipo
                                          ELSE tip_pro
                                        END
                      END ASC
    END
```
