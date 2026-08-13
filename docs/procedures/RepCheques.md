# SP: RepCheques
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <07/09/2010>
-- Description:	<Cheques>
-- =============================================
CREATE PROCEDURE [RepCheques]
    @sCo_cheq_d CHAR(20) = NULL ,
    @sCo_cheq_h CHAR(20) = NULL ,
    @sCo_cta_d CHAR(6) = NULL ,
    @sCo_cta_h CHAR(6) = NULL ,
    @sCo_co_chra_d CHAR(6) = NULL ,
    @sCo_co_chra_h CHAR(6) = NULL ,
    @sCo_moneda CHAR(6) = NULL ,
    @sStatus_che CHAR(4) = NULL ,
    @sCo_Inactivo CHAR(4) = NULL ,
    @sStatus_chra CHAR(4) = NULL ,
    @sEntregado CHAR(6) = NULL ,
    @sCo_Sucu CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sCo_Inactivo = 'TODO' ) 
            SET @sCo_Inactivo = NULL		

        IF ( @sCo_Inactivo = 'SIT' ) 
            SET @sCo_Inactivo = 1
	
        IF ( @sCo_Inactivo = 'NOT' ) 
            SET @sCo_Inactivo = 0	
	
        IF ( @sStatus_che = 'TOD' ) 
            SET @sStatus_che = NULL

	
        SELECT
            Che.Co_cheq, mv.fecha, ISNULL(mv.monto_d, 0.00) AS monto, mv.descrip, Cheq.cod_cta, Che.co_chra, Che.status,
            cu.num_cta, cu.co_mone, cu.inactivo, cheq.status AS status_cheq,
            CASE WHEN che.fec_ent = '1900-01-01 00:00:00' THEN ''
                 ELSE che.fec_ent
            END AS fec_ent, ISNULL(che.entreg_a, '') AS entreg_a, che.co_sucu_in
        FROM
            saCheque Che
            INNER JOIN saChequera cheq ON che.co_chra = cheq.co_chra
            INNER JOIN saCuentaBancaria cu ON cheq.cod_cta = cu.cod_cta
            LEFT JOIN saMovimientoBanco mv ON Che.mov_num = mv.mov_num
        WHERE
            ( ( @sCo_cheq_d IS NULL
                OR Che.Co_cheq >= @sCo_cheq_d
              )
              AND ( @sCo_cheq_h IS NULL
                    OR Che.Co_cheq <= @sCo_cheq_h
                  )
            )
            AND ( ( @sCo_cta_d IS NULL
                    OR Cheq.cod_cta >= @sCo_cta_d
                  )
                  AND ( @sCo_cta_h IS NULL
                        OR Cheq.cod_cta <= @sCo_cta_h
                      )
                )
            AND ( ( @sCo_co_chra_d IS NULL
                    OR Che.co_chra >= @sCo_co_chra_d
                  )
                  AND ( @sCo_co_chra_h IS NULL
                        OR Che.co_chra <= @sCo_co_chra_h
                      )
```
