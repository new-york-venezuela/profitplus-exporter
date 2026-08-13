# SP: pActualizarStatusChequeDevuelto
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pActualizarStatusChequeDevuelto
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarStatusChequeDevuelto]
    (
      @sCodPago CHAR(20) ,
      @sNum_Doc CHAR(20)
    )
AS 
    BEGIN
        DECLARE @bDevuelto BIT
        SET @bDevuelto = ( SELECT
                            devuelto
                           FROM
                            sapagoTPReng
                           WHERE
                            cob_num = @sCodPago
                            AND num_doc = @sNum_Doc
                            AND forma_pag ='CH'
                         ) 

        IF ( @bDevuelto = 1 ) 
            UPDATE
                sapagoTPReng
            SET devuelto = 0
            WHERE
                cob_num = @sCodPago AND num_doc = @sNum_Doc
        IF ( @bDevuelto = 0 ) 
            UPDATE
                sapagoTPReng
            SET devuelto = 1
            WHERE
                cob_num = @sCodPago AND num_doc = @sNum_Doc

    END
```
