# SP: pSeleccionarConfigMovCaja
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saConfigMovCaja`](../tables/saConfigMovCaja.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarConfigMovCaja
DESCRIPCION: Selecciona una configuración segun el codigo de config pasado por parametro
CREADO POR:  SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarConfigMovCaja] ( @sCo_Config CHAR(6) )
AS 
    BEGIN
        SELECT
            [co_config], [des_config], [co_usuario], [co_mapa], [xml_squema], [xml_data], [xml_reglas], [campo1],
            [campo2], [campo3], [campo4], [campo5], [campo6], [campo7], [campo8], [validador], [co_us_in], [co_sucu_in],
            [fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [revisado], [trasnfe], [rowguid]
        FROM
            saConfigMovCaja
        WHERE
            co_config = @sCo_Config
    END
```
