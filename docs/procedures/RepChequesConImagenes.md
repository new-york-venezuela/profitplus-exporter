# SP: RepChequesConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16/01/2015>
-- Description:	<Cheques Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepChequesConImagenes]
    @sCo_cheq_d CHAR(20) = NULL ,
    @sCo_cheq_h CHAR(20) = NULL ,
    @sCo_cta_d CHAR(6) = NULL ,
    @sCo_cta_h CHAR(6) = NULL ,
    @sCo_co_chra_d CHAR(6) = NULL ,
    @sCo_co_chra_h CHAR(6) = NULL ,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,
    @sCo_moneda CHAR(6) = NULL ,
    @sStatus_che CHAR(4) = NULL ,        
    @sEntregado CHAR(6) = NULL ,
    @sCo_Sucu CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
        IF ( @sStatus_che = 'TOD' ) 
            SET @sStatus_che = NULL

	
        SELECT
            Che.Co_cheq, mv.fecha, ISNULL(mv.monto_d, 0.00) AS monto, mv.descrip, Cheq.cod_cta, Che.co_chra, Che.status,
            cu.num_cta, cu.co_mone, cu.inactivo, cheq.status AS status_cheq,
            CASE WHEN che.fec_ent = '1900-01-01 00:00:00' THEN ''
                 ELSE che.fec_ent
            END AS fec_ent, ISNULL(che.entreg_a, '') AS entreg_a, che.co_sucu_in, 
				DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen
        FROM
            saCheque Che
            INNER JOIN saChequera cheq ON che.co_chra = cheq.co_chra
            INNER JOIN saCuentaBancaria cu ON cheq.cod_cta = cu.cod_cta
            LEFT JOIN saMovimientoBanco mv ON Che.mov_num = mv.mov_num
			left outer join saDocumentoImagen DI 
			inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON Che.rowguid = DI.rowguidDoc
        WHERE
		DI.co_imag is not null and
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
                        OR
```
