# SP: pActualizarCostoHistoricoSalida
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE : [pActualizarCostoHistoricoSalida]
*DESCRIPCIÓN : Actualiza un registro de la tabla saCostoHistoricoSalida
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [pActualizarCostoHistoricoSalida]
    (
      @gCod_Costo_Historico_Salida UNIQUEIDENTIFIER ,
      @deCantidad DECIMAL(18, 5)
    )
AS 
    BEGIN
        UPDATE
            saCostoHistoricoSalida
        SET cantidad = @deCantidad
        WHERE
            cod_costo_historico_salida = @gCod_Costo_Historico_Salida
    END
```
