# SP: RepFormatoCheque
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <28-07-10>
 Description:	<Formato de Cheque>
 =============================================*/
CREATE PROCEDURE [dbo].[RepFormatoCheque]
	-- Add the parameters for the stored procedure here
    @sCo_Ord_d CHAR(20) = NULL ,
    @sCo_Ord_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT 
            OP.ord_num, OP.descrip, OP.fec_pag, OP.doc_num, OPR2.monto, OPR2.MontoEscrito, OPR.co_cta_ingr_egr, OPR.monto_d, 
            OPR.monto_h, OPR.monto_iva, OPR.monto_reten, BE.ben_des, CB.cod_cta, CB.num_cta, B.des_ban, OP.fecha
        -- Sit.#642332
        -- Se agrego el campo fecha    
        FROM
            saOrdenPago AS OP
            INNER JOIN
            (SELECT ord_num, SUM(monto_d - monto_h - monto_reten) AS monto,
             ISNULL(dbo.MontoEscrito(SUM(monto_d) - SUM(monto_h) - SUM(monto_reten)), 0) AS MontoEscrito
             FROM saOrdenPagoReng GROUP BY ord_num) AS OPR2 ON OPR2.ord_num = OP.ord_num
            INNER JOIN saOrdenPagoReng AS OPR ON OPR.ord_num = OP.ord_num
            LEFT JOIN saBeneficiario AS BE ON BE.cod_ben = OP.cod_ben
            LEFT JOIN saCuentaBancaria AS CB ON CB.cod_cta = OP.cod_cta
            LEFT JOIN saBanco AS B ON B.co_ban = CB.co_ban
        WHERE
            ( ( @sCo_Ord_d IS NULL
                OR OP.ord_num >= @sCo_Ord_d
              )
              AND ( @sCo_Ord_h IS NULL
                    OR OP.ord_num <= @sCo_Ord_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR OP.co_sucu_in = @sCo_Sucursal
                )
        GROUP BY
            OP.ord_num, OP.descrip, OP.fec_pag, OP.doc_num, OPR.co_cta_ingr_egr, OPR.monto_d, OPR.monto_h, OPR.monto_iva,
            OPR.monto_reten, BE.ben_des, CB.cod_cta, CB.num_cta, B.des_ban,OPR2.monto,OPR2.MontoEscrito, OP.fecha
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'descrip' THEN OP.descrip
                                 ELSE OP.ord_num
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'descrip' THEN OP.descrip
```
