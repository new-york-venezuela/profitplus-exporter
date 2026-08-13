# SP: pSeleccionarRenglonesLoteSalida
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:	[pSeleccionarRenglonesLoteSalida]
DESCRIPCION	:	Procedimiento para seleccionar todos los lotes asociados a un documento
CREADO POR	:	SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarRenglonesLoteSalida]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER
	
    )
AS 
    BEGIN

        SELECT
            s.*, e.Fecha_Expiracion, e.Stock_actual
	--s.*,
	-- l.rowguid as Rowguid_Lote
        FROM
            saLoteSalida s join saLoteEntrada e on s.Rowguid_Lote = e.rowguid 
	--INNER JOIN   saLoteEntrada l ON (l.co_art = s.co_art and l.co_alma = s.co_alma 
	--						and l.numero_lote = s.numero_lote)
        WHERE
            s.rowguid_reng = @gRowguid_Reng
	
    END
```
