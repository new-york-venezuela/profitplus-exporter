# SP: pSeleccionarRenglonesCheque
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCheque
DESCRIPCION: Procedimiento para seleccionar todos los cheques asociados a una chequera
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarRenglonesCheque]
    (
      @sCo_Chra CHAR(6) ,
      @sStatus CHAR(3) = NULL
	
    )
AS 
    BEGIN
        SELECT
            ch.co_cheq, ch.co_chra, ch.mov_num, ch.status, ISNULL(ch.descrip, mb.descrip) AS descrip,
            ISNULL(mb.monto_d, 0) AS monto, CASE WHEN ch.status = 'DIS' THEN NULL
                                                 ELSE mb.fecha
                                            END fec_emis, ch.entreg_a, ch.co_us_in, ch.co_sucu_in, ch.fe_us_in,
            ch.co_us_mo, ch.co_sucu_mo, ch.fe_us_mo, ch.revisado, ch.trasnfe, ch.rowguid, ch.validador
        FROM
            saCheque ch
            LEFT JOIN saMovimientoBanco mb ON ch.mov_num = mb.mov_num
        WHERE
            ch.co_chra = @sCo_Chra
            AND ( ch.status = @sStatus
                  OR @sStatus = 'TOD'
                )
        ORDER BY
           ch.co_cheq
           --CAST(ch.co_cheq as numeric) 

    END
```
