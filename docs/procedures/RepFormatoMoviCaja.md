# SP: RepFormatoMoviCaja
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <27/05/2010>
-- Description:	<Formato Movimiento de Caja>
-- =============================================
CREATE PROCEDURE [RepFormatoMoviCaja]
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
            CIE.descrip AS Des_cta_ing_egr, MC.co_tar, TA.des_tar, CA.descrip, MO.mone_des, CA.co_mone, BA.des_ban, MC.*
        FROM
            saMovimientoCaja AS MC
            LEFT JOIN saBanco AS BA ON BA.co_ban = MC.co_ban
            INNER JOIN saCaja AS CA ON CA.cod_caja = MC.cod_caja
            INNER JOIN saMoneda AS MO ON MO.co_mone = CA.co_mone
            LEFT JOIN saTarjetaCredito AS TA ON TA.co_tar = MC.co_tar
            INNER JOIN saCuentaIngEgr AS CIE ON CIE.co_cta_ingr_egr = MC.co_cta_ingr_egr
        WHERE
            ( ( @cCo_Numero_d IS NULL
                OR MC.mov_num >= @cCo_Numero_d
              )
              AND ( @cCo_Numero_h IS NULL
                    OR MC.mov_num <= @cCo_Numero_h
                  )
            )
            AND ( MC.anulado = 0 )
            AND ( @cCo_Sucursal IS NULL
                  OR @cCo_Sucursal = MC.co_sucu_in
                )
        ORDER BY
            MC.mov_num
	
		
    END
```
