# SP: RepClienteDatosCredito
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <25-08-11>
-- Description:	<Clientes con sus Datos de Crédito>
-- =============================================
CREATE PROCEDURE [RepClienteDatosCredito]
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
            co_cli, cli_des, mont_cre, plaz_pag, desc_ppago, desc_glob, lunes, martes, miercoles, jueves, viernes, sabado, domingo, frecu_vist, horar_caja, 
puntaje, comentario
        FROM
            saCliente
            --INNER JOIN saTipoCliente AS TC ON TC.tip_cli = C.tip_cli
        WHERE
            (( @sCo_Cli_d IS NULL
                OR co_cli >= @sCo_Cli_d
              )
              AND ( @sCo_Cli_h IS NULL
                    OR co_cli <= @sCo_Cli_h
                  )
            )
            AND (( @sCo_Ven_d IS NULL
                    OR co_ven >= @sCo_Ven_d
                  )
                  AND ( @sCo_Ven_h IS NULL
                        OR co_ven <= @sCo_Ven_h
                      )
                )
            AND (( @sCo_Tipcli_d IS NULL
                    OR tip_cli >= @sCo_Tipcli_d
                  )
                  AND ( @sCo_Tipcli_h IS NULL
                        OR tip_cli <= @sCo_Tipcli_h
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
                  OR ( @s
```
