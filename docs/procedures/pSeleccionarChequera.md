# SP: pSeleccionarChequera
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarChequera
DESCRIPCION: Seleccionar Chequera
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarChequera] ( @sCo_Chra CHAR(6) )
AS 
    BEGIN
        SELECT
            [co_chra], [chra_des], [cod_cta], [status], [num_ch], [fecha_re], [respons], [limUsoRe], [campo1], [campo2],
            [campo3], [campo4], [campo5], [campo6], [campo7], [campo8], [co_us_in], [co_sucu_in], [fe_us_in], [co_us_mo],
            [co_sucu_mo], [fe_us_mo], [revisado], [trasnfe], [validador], [rowguid]
        FROM
            [saChequera]
        WHERE
            Co_Chra = @sCo_Chra
    END
```
