# SP: pSeleccionarParametroConc
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saParametroConc`](../tables/saParametroConc.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarParametroConc
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarParametroConc]
    (
      @sCo_Conf CHAR(6) ,
      @sCo_Ban CHAR(6)
    )
AS 
    BEGIN

        SELECT
            [co_conf], [des_conf], [co_ban], [opc_doc], [conc_parcial], [cantidadDig], [opc_fec], [margenInf],
            [margenSup], [campo1], [campo2], [campo3], [campo4], [campo5], [campo6], [campo7], [campo8], [co_us_in],
            [co_sucu_in], [fe_us_in], [co_us_mo], [co_sucu_mo], [fe_us_mo], [revisado], [trasnfe], [validador],
            [rowguid]
        FROM
            [saParametroConc]
        WHERE
            co_conf = @sCo_Conf
            AND co_ban = @sCo_Ban
  
    END
```
