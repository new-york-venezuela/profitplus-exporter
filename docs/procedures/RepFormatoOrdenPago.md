# SP: RepFormatoOrdenPago
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <29-07-10>
 Description:	<Formato de Orden de Pago>
 =============================================*/
CREATE PROCEDURE [dbo].[RepFormatoOrdenPago]
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
            OP.*, OPR.*, BE.cod_ben, BE.ben_des, BE.telefonos, CB.cod_cta, CB.num_cta, CB.co_ban, B.des_ban, CIE.descrip as descrip_cta_ie
        FROM
            saOrdenPago AS OP
            INNER JOIN saOrdenPagoReng AS OPR ON OPR.ord_num = OP.ord_num
            LEFT JOIN saBeneficiario AS BE ON BE.cod_ben = OP.cod_ben
            LEFT JOIN saCuentaBancaria AS CB ON CB.cod_cta = OP.cod_cta
            LEFT JOIN saBanco AS B ON B.co_ban = CB.co_ban
            LEFT JOIN saCuentaIngEgr AS CIE ON CIE.co_cta_ingr_egr= OPR.co_cta_ingr_egr
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
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'descrip' THEN OP.descrip
                                 ELSE OP.ord_num
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'descrip' THEN OP.descrip
                                          ELSE OP.ord_num
                                        END
                      END ASC
    END
```
