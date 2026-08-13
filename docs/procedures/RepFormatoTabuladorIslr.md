# SP: RepFormatoTabuladorIslr
**Tipo**: Reporte
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saConISLR`](../tables/saConISLR.md)
- [`saTabuladorIslr`](../tables/saTabuladorIslr.md)
- [`saTabuladorIslrReng`](../tables/saTabuladorIslrReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <04-10-10>
 Description:	<Formato Tabulador Islr>
 =============================================*/
CREATE PROCEDURE [RepFormatoTabuladorIslr]
	-- Add the parameters for the stored procedure here
    @sNum_tab_d CHAR(20) = NULL ,
    @sNum_tab_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            TA.co_tab, TA.tab_des, TA.tipo_per, CO.co_islr, CO.islr_des, TAR.porc_imp, TAR.porc_ret, TAR.sustraen
        FROM
            saTabuladorIslr AS TA
            INNER JOIN saTabuladorIslrReng AS TAR ON TA.co_tab = TAR.co_tab
            LEFT JOIN saConISLR AS CO ON CO.co_islr = TAR.co_islr
        WHERE
            ( ( @sNum_tab_d IS NULL
                OR TA.co_tab >= @sNum_tab_d
              )
              AND ( @sNum_tab_h IS NULL
                    OR TA.co_tab <= @sNum_tab_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR TA.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            TA.co_tab

    END
```
