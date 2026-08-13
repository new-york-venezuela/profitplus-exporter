# SP: pActualizarStatusAutOrdenPago
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saOrdenPago`](../tables/saOrdenPago.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pActualizarStatusAutOrdenPago
*DESCRIPCIÓN	:	Actualiza el status de la autorizacion de la orden de pago
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE [pActualizarStatusAutOrdenPago]
    (
      @sOrd_Num CHAR(20) ,
      @tsValidador TIMESTAMP ,
      @iPagar INT
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )		

        UPDATE
            saOrdenPago
        SET pagar = @iPagar, fe_us_mo = GETDATE()
        OUTPUT
            Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Ord_Num = @sOrd_Num
            AND validador = @tsvalidador
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
        SELECT
            *
        FROM
            @TableTimestamp
		
    END
```
