# SP: pSeleccionarOrdenPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarOrdenPago
DESCRIPCION: Selecciona los campos de la tabla Orden de Pago
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarOrdenPago] ( @sOrd_Num CHAR(20) )
AS 
    BEGIN
		Declare @tsMarcaTiempoCheque TIMESTAMP
		Declare @mbDocNum varchar(20)
		Declare @mbCodCta char(6)
		
		Select @mbDocNum = op.doc_num, @mbCodCta =  op.cod_cta
			From saOrdenPago op
		Where op.forma_pag = 'CH' and op.ord_num = @sOrd_Num
		
		If @mbDocNum is null
			Set @tsMarcaTiempoCheque = null
		Else
		Begin
			Select @tsMarcaTiempoCheque = CH.validador From saCheque CH
			Inner Join saChequera CHRA ON CH.co_chra = CHRA.co_chra
			Where CH.co_cheq = @mbDocNum and CHRA.cod_cta = @mbCodCta
		End
    
        SELECT
            op.*, cb.co_ban, @tsMarcaTiempoCheque AS MarcaTiempoCheque
        FROM
            saOrdenPago op
            LEFT JOIN saCuentaBancaria cb ON cb.cod_cta = op.cod_cta
        WHERE
            ord_num = @sOrd_Num
    END
```
