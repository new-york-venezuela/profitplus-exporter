# SP: pObtenerChequeEntregado
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <18/11/2010>
-- Description:	<Obtiene los cheques entregados al proveedor>
-- =============================================
CREATE PROCEDURE [pObtenerChequeEntregado]
    (
      @sCo_cheque CHAR(20) ,
      @scod_cta CHAR(6)
    )
AS 
    BEGIN

        DECLARE @UNIDAD BIT

        SET @UNIDAD = ISNULL(( SELECT
                                CASE WHEN ( b.fec_ent IS NOT NULL )
                                          AND ( b.entreg_a IS NOT NULL ) THEN 1
                                     ELSE 0
                                END AS unidad
                               FROM
                                sachequera AS a
                                INNER JOIN sacheque AS b ON a.co_chra = b.co_chra
                               WHERE
                                ( b.fec_ent IS NOT NULL )
                                AND ( b.entreg_a IS NOT NULL )
                                AND ( b.co_cheq = @sCo_cheque )
                                AND ( a.cod_cta = @scod_cta )
                             ), 0)

        SELECT
            @UNIDAD
	
    END
```
