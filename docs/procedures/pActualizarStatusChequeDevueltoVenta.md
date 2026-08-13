# SP: pActualizarStatusChequeDevueltoVenta
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:pActualizarStatusChequeDevueltoVenta
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarStatusChequeDevueltoVenta]
    (
      @sCodCobro CHAR(20) ,
      @sNum_Doc CHAR(20)
    )
AS 
    BEGIN
        DECLARE @bDevuelto BIT
        SET @bDevuelto = ( SELECT
                            devuelto
                           FROM
                            saCobroTPReng
                           WHERE
                            cob_num = @sCodCobro
                            AND num_doc = @sNum_Doc
                            AND forma_pag ='CH'
                         ) 

        IF ( @bDevuelto = 1 ) 
            UPDATE
                saCobroTPReng
            SET devuelto = 0
            WHERE
                cob_num = @sCodCobro AND num_doc = @sNum_Doc
        IF ( @bDevuelto = 0 ) 
            UPDATE
                saCobroTPReng
            SET devuelto = 1
            WHERE
                cob_num = @sCodCobro AND num_doc = @sNum_Doc

    END
```
