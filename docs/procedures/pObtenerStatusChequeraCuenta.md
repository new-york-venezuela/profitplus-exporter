# SP: pObtenerStatusChequeraCuenta
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pObtenerStatusChequeraCuenta
*DESCRIPCION	:	Obtiene una lista de chequeras y chequeas por c/disponible asi como su estatus
*AUTOR			:	SOFTECH SISTEMAS.
*FECHA			:	11/11/2009
**********************************************************************************************/
CREATE PROCEDURE [pObtenerStatusChequeraCuenta] ( @sCodCuenta CHAR(6) )
AS 
    BEGIN

        SELECT
            chr.Co_Chra, chr.Fecha_Re, chr.Num_Ch, chr.Status, ISNULL(( SELECT
                                                                            MIN(chq.co_cheq)
                                                                        FROM
                                                                            saCheque chq
                                                                        WHERE
                                                                            chq.co_chra = chr.co_chra
                                                                      ), '') Num_Ch_P,
            ISNULL(( SELECT
                        MAX(chq.co_cheq)
                     FROM
                        saCheque chq
                     WHERE
                        chq.co_chra = chr.co_chra
                   ), '') Num_Ch_U, ( SELECT
                                        COUNT(*)
                                      FROM
                                        saCheque chq
                                      WHERE
                                        chq.co_chra = chr.co_chra
                                    ) TotalCheque, ( SELECT
                                                        COUNT(*)
                                                     FROM
                                                        saCheque chq
                                                     WHERE
                                                        chq.co_chra = chr.co_chra
                                                        AND chq.Status = 'DIS'
                                                   ) Disponible
        FROM
            saChequera chr
        WHERE
            chr.cod_cta = @sCodCuenta

    END
```
