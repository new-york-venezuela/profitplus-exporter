# SP: pValidarTrasladoMontoDistribuidoProrateo
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarTrasladoMontoDistribuidoProrateo]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS  
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN    
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(256) )

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                R.tras_num, R.reng_num, R.costo_adi1,
                ROUND(( ( E.monto_dist * ROUND(R.total_art * cost_unit, 2) ) / [dbo].[saTrasladoCostoTotal](R.tras_num) )
                      / R.total_Art, 2) AS costo_adi1Real, R.rowguid
            FROM
                saTrasladoReng R
                INNER JOIN saTraslado E ON E.tras_num = R.tras_num
            WHERE
                R.costo_adi1 <> ROUND(( ( E.monto_dist * ROUND(R.total_art * cost_unit, 2) )
                                        / [dbo].[saTrasladoCostoTotal](R.tras_num) ) / R.total_Art, 2)
                AND R.reng_num <> ( SELECT
                                        MAX(reng_num)
                                    FROM
                                        saTrasladoReng RMAX
                                    WHERE
                                        RMAX.tras_num = E.tras_num
                                  )
            UNION
            SELECT
                R.tras_num, R.reng_num, R.costo_adi1,
                ( E.monto_dist - ( SELECT
                                    isnull(SUM(ROUND(RAUX.costo_adi1 * RAUX.total_art, 2)),0)
                                   FROM
                                    saTrasladoReng RAUX
                                   WHERE
                                    RAUX.tras_num = E.tras_num
                                    AND RAUX.reng_num <> R.reng_num
                                 ) ) / R.total_Art AS costo_adi1Real, R.rowguid
            FROM
                saTrasladoReng R
                INNER JOIN saTraslado E ON E.tras_num = R.tras_num
            WHERE
                R.costo_adi1 <> ( E.monto_dist - ( SELECT
                                                    isnull(SUM(ROUND(RAUX.costo_adi1 * RAUX.total_art, 2)),0)
                                                   FROM
                                                    saTrasladoReng RAUX
                                                   WHERE
                                                    RAUX.tras_num = E.tras_num
```
