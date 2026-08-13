# SP: pActualizarLoteAnula
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarLoteAnula]
*DESCRIPCIÓN	: Validar existencia del lote en saLote
*AUTOR			: Softech Sistemas
*FECHA			: 2009-10-08
**************************************************************************/

CREATE PROCEDURE [pActualizarLoteAnula]
    (
      @sNumero_Lote CHAR(20) ,
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
            AND rowguid <> @gRowguid

    END
```
