# SP: RepFormatoMoviBanco
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20/05/2010>
-- Description:	<Formato Movimiento de Banco>
-- =============================================
CREATE PROCEDURE [RepFormatoMoviBanco]
	-- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here
        SELECT
            CU.num_cta, CU.co_mone, MO.mone_des, BA.co_ban, BA.des_ban, CIE.descrip AS Des_Cta_Ing_Egr, BA.des_ban, MB.*
        FROM
            saMovimientoBanco AS MB
            INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
            INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
            INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
            INNER JOIN saCuentaIngEgr AS CIE ON CIE.co_cta_ingr_egr = MB.co_cta_ingr_egr
        WHERE
            ( ( @cCo_Numero_d IS NULL
                OR MB.mov_num >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR MB.mov_num <= @cCo_Numero_h
                  )
            )
            AND ( MB.anulado = 0 )
            AND ( @cCo_Sucursal IS NULL
                  OR @cCo_Sucursal = MB.co_sucu_in
                )
        ORDER BY
            MB.mov_num
	
		
    END
```
