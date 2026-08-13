# SP: pSeleccionarResInventario
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)
- [`saResInventario`](../tables/saResInventario.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarResInventario
DESCRIPCION: Busca el ResInventario segun el numero del mismo
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarResInventario] ( @sNum_ResInv CHAR(20) )
AS 
    BEGIN
        SELECT
            R.*, I.procesado, I.inicio
        FROM
            saResInventario R
            INNER JOIN saInventarioFisico I ON R.co_invfisico = I.co_invfisico
        WHERE
            R.num_resinv = @sNum_ResInv
    END
```
