# SP: pValidarCostoEntradaReasignar
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarCostoEntradaReasignar]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @dtFechaDesde DATETIME = NULL ,
    @dtFechaHasta DATETIME = NULL
AS 
    BEGIN
	-- AJUS: Ajuste de Salida, TRAS: Traslado de Salida, RGEN: Renglones de COmpuesto
	-- FACT: Factura de Venta,	NENT: Nota de Entrega, DPRO: Devolución a Proveedor

        BEGIN TRAN
		
		--AJUS: Ajuste de Salida Borrar Historicos
		
		-- Borrar entradas actuales
        DELETE FROM
            saCostoHistoricoEntrada
        WHERE
            saCostoHistoricoEntrada.tipo_doc = 'AJUS'
            AND EXISTS ( SELECT
                            *
                         FROM
                            saAjusteReng R
                            INNER JOIN saAjuste E ON E.ajue_num = R.ajue_num
                            INNER JOIN saTipoAjuste TA ON TA.co_tipo = R.co_tipo
                                                          AND TA.tipo_trans = '0'
                         WHERE
                            saCostoHistoricoEntrada.doc_orig = R.rowguid
                            AND ( @dtFechaDesde IS NULL
                                  OR E.fecha <= @dtFechaDesde
                                )
                            AND ( @dtFechahasta IS NULL
                                  OR E.fecha >= @dtFechaHasta
                                ) )

		-- Borrar Huerfanos
        DELETE FROM
            saCostoHistoricoEntrada
        WHERE
            saCostoHistoricoEntrada.tipo_doc = 'AJUS'
            AND NOT EXISTS ( SELECT
                                *
                             FROM
                                saAjusteReng R
                             WHERE
                                saCostoHistoricoEntrada.doc_orig = R.rowguid )
		

		--AJUS: FIN Ajuste de Salida Borrar Historicos

        DECLARE @RowGuid_Actual UNIQUEIDENTIFIER
        DECLARE @Total_Art_Actual DECIMAL(18, 5)
        DECLARE @Tipo_Doc_Actual CHAR(4)
        DECLARE @Fecha_Registro_Actual DATETIME
        DECLARE @Fecha_Emision_Actual DATETIME
        DECLARE @Fecha_Recepcion_Actual DATETIME
        DECLARE @Cod_Almacen_Actual CHAR(6)
        DECLARE @RowGuid_Art_Actual UNIQUEIDENTIFIER
        DECLARE @Costo_Actual DECIMAL(18, 5)
	

        DECLARE Entradas_Cursor CURSOR FORWARD_ONLY
        FOR
            SELECT
                R.rowguid AS Doc_Orig, R.total_art AS cantidad, 'AJUS' AS Tipo_Doc
```
