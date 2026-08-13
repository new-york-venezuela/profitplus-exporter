# SP: pValidarExistenciaLote
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/***************************************************************************************
*NOMBRE: [pValidarExistenciaLote]
*DESCRIPCIÓN : valida si existe un lote asociado al documento
*AUTOR: SOFTECH SISTEMAS
****************************************************************************************/

CREATE PROCEDURE [pValidarExistenciaLote]
    (
      @sNumero_Lote CHAR(20) ,
      @sCo_Art CHAR(30),
      @gRowguid UNIQUEIDENTIFIER
    )
AS 
    BEGIN	

        SELECT TOP ( 1 )
            numero_lote
        FROM
            saLoteEntrada
        WHERE
            numero_lote = @sNumero_Lote
            AND co_art = @sCo_Art
            --AND rowguid <> @gRowguid

    END
```
