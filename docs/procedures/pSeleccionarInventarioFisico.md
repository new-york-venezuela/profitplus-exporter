# SP: pSeleccionarInventarioFisico
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saInventarioFisico`](../tables/saInventarioFisico.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarInventarioFisico
DESCRIPCION: Selecciona el registro de inventario fisico
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarInventarioFisico]
    (
      @sCo_InvFisico CHAR(20)
    )
AS 
    BEGIN
        SELECT
            *, dbo.InventarioAsociado(@sCo_InvFisico) AS relacion
        FROM
            saInventarioFisico
        WHERE
            co_invfisico = @sCo_InvFisico
    END
```
