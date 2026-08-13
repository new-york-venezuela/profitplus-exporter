# SP: RepClienteDatosBasicos
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-07-10>
-- Description:	<Clientes con Datos Básicos>
-- =============================================
CREATE PROCEDURE [RepClienteDatosBasicos]
	-- Add the parameters for the stored procedure here
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Tipcli_d CHAR(6) = NULL ,
    @sCo_Tipcli_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Pais_d CHAR(6) = NULL ,
    @sCo_Pais_h CHAR(6) = NULL ,
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
            C.*, TC.des_tipo
        FROM
            saCliente AS C
            INNER JOIN saTipoCliente AS TC ON TC.tip_cli = C.tip_cli
        WHERE
            ( ( @sCo_Cli_d IS NULL
                OR C.co_cli >= @sCo_Cli_d
              )
              AND ( @sCo_Cli_h IS NULL
                    OR C.co_cli <= @sCo_Cli_h
                  )
            )
            AND ( ( @sCo_Ven_d IS NULL
                    OR C.co_ven >= @sCo_Ven_d
                  )
                  AND ( @sCo_Ven_h IS NULL
                        OR C.co_ven <= @sCo_Ven_h
                      )
                )
            AND ( ( @sCo_Tipcli_d IS NULL
                    OR C.tip_cli >= @sCo_Tipcli_d
                  )
                  AND ( @sCo_Tipcli_h IS NULL
                        OR C.tip_cli <= @sCo_Tipcli_h
                      )
                )
            AND ( ( @sCo_Zon_d IS NULL
                    OR C.co_zon >= @sCo_Zon_d
                  )
                  AND ( @sCo_Zon_h IS NULL
                        OR C.co_zon <= @sCo_Zon_h
                      )
                )
            AND ( ( @sCo_Seg_d IS NULL
                    OR C.co_seg >= @sCo_Seg_d
                  )
                  AND ( @sCo_Seg_h IS NULL
                        OR C.co_seg <= @sCo_Seg_h
                      )
```
