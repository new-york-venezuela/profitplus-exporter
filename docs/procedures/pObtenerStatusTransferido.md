# SP: pObtenerStatusTransferido
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**********************************************************************************************
*NOMBRE			:	pObtenerStatusTransferido
*DESCRIPCION	:	Obtiene si una movimiento de caja fue tranferido 
*AUTOR			:	SOFTECH SISTEMAS
*FECHA			:	04/08/2010
**********************************************************************************************/
CREATE PROCEDURE [pObtenerStatusTransferido]
    (
      @sMov_Num CHAR(20) ,
      @sMov_Nro CHAR(20)
    )
AS 
    BEGIN

        UPDATE
            saMovimientoCaja
        SET mov_nro = @sMov_Num
        WHERE
            mov_num = @sMov_Nro

    END
```
