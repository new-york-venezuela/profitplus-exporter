# SP: pv_ObtenerPais
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saPais`](../tables/saPais.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE                    :      [pv_ObtenerPais]
*DESCRIPCIÓN :      OBTIENE LA LISTA DE PAISES DE LA TABLA 'saPais' PARA LA CREACION DE CLIENTE
                                  RAPIDO DESDE PUNTO DE VENTA
*AUTOR              :      SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [dbo].[pv_ObtenerPais]
AS
       BEGIN
             SELECT co_pais, pais_des FROM saPais 
       END
```
