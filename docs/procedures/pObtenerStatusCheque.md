# SP: pObtenerStatusCheque
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <03/04/2011>
-- Description:	<Obtiene el status cheque>
-- =============================================
CREATE PROCEDURE [pObtenerStatusCheque]
    (
      @sCo_cheque CHAR(20),
      @scod_cta CHAR(6)
    )
AS 
    BEGIN
      
       SELECT ISNULL(CASE WHEN ( b.status='EMI' or b.status='ANU') THEN 1
       ELSE 0
       END ,0) AS unidad
       FROM
       sachequera AS a
       INNER JOIN sacheque AS b ON a.co_chra = b.co_chra
       WHERE( b.co_cheq = @sCo_cheque )
        AND ( a.cod_cta = @scod_cta )
  
    END
```
