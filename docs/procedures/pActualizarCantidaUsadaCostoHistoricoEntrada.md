# SP: pActualizarCantidaUsadaCostoHistoricoEntrada
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE : [pInsertarCostoHistoricoSalida]
*DESCRIPCIÓN : Inserta un nuevo registro a la tabla saCostoHistoricoSalida
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [pActualizarCantidaUsadaCostoHistoricoEntrada]
    (
      @gCod_Costo_Historico_Entrada UNIQUEIDENTIFIER ,
      @deCantidad DECIMAL(18, 5) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 


    )
AS 
    BEGIN

        UPDATE
            saCostoHistoricoEntrada
        SET cantidad_usada = cantidad_usada + @deCantidad
        WHERE
            cod_costo_historico_entrada = @gCod_Costo_Historico_Entrada
		

    END
```
