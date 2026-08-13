# SP: pSeleccionarRenglonesOrdenPago
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saOrdenPagoReng`](../tables/saOrdenPagoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarOrdenPagoRenglon
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR : SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesOrdenPago] ( @sOrd_Num CHAR(20) )
AS 
    BEGIN 

        SELECT
            op.*, cie.descrip AS Descrip_Cta_Ingr, ( op.monto_d + op.monto_h ) AS monto_pre
        FROM
            saOrdenPagoReng AS op
            INNER JOIN saCuentaIngEgr AS cie ON op.co_cta_ingr_egr = cie.co_cta_ingr_egr
        WHERE
            ord_num = @sOrd_Num
        ORDER BY
            reng_num ASC
    END
```
