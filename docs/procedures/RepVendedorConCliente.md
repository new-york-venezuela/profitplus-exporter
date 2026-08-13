# SP: RepVendedorConCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <21-07-10>
-- Description:	<Vendedor con sus Clientes>
-- =============================================
CREATE PROCEDURE [RepVendedorConCliente]
	-- Add the parameters for the stored procedure here
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

---------------Valores por Defecto-------------------
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'co_ven'

--------------------------------------------------------


        SELECT
            V.*, C.co_cli, C.cli_des, C.rif, C.co_zon, C.telefonos, C.tip_cli, TC.des_tipo
        FROM
            saVendedor AS V
            LEFT JOIN saCliente C ON C.co_ven = V.co_ven
            LEFT JOIN saTipoCliente TC ON TC.tip_cli = C.tip_cli
        WHERE
            ( ( @sCo_Ven_d IS NULL
                OR V.co_ven >= @sCo_Ven_d
              )
              AND ( @sCo_Ven_h IS NULL
                    OR V.co_ven <= @sCo_Ven_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR V.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'ven_des' THEN V.ven_des
                                 ELSE V.co_ven
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'ven_des' THEN V.ven_des
                                          ELSE V.co_ven
                                        END
                      END ASC
    END
```
