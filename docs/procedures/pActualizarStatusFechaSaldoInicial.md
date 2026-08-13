# SP: pActualizarStatusFechaSaldoInicial
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pActualizarStatusChequeDevuelto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarStatusFechaSaldoInicial]
    (
      @sCodCta CHAR(20) ,
      @sdFecha SMALLDATETIME
	
    )
AS 
    BEGIN
        UPDATE
            saCuentaBancaria
        SET fecini = @sdFecha
        WHERE
            cod_cta = @sCodCta

    END
```
