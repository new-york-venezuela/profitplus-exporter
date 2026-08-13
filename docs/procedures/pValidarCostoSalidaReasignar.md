# SP: pValidarCostoSalidaReasignar
**Tipo**: Validar
**Módulo**: General

## Código (excerpt)
```sql
--***************************-----------------
CREATE PROCEDURE [pValidarCostoSalidaReasignar]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @dtFechaDesde DATETIME = NULL ,
    @dtFechaHasta DATETIME = NULL
AS 
    BEGIN
	-- AJUS: Ajuste de Salida, TRAS: Traslado de Salida, RGEN: Renglones de COmpuesto
	-- FACT: Factura de Venta,	NENT: Nota de Entrega, DPRO: Devolución a Proveedor

        BEGIN TRAN
		-- Probablemte cambiar or invocación a [pCostoActualizarSalidas]
        COMMIT
    END
```
