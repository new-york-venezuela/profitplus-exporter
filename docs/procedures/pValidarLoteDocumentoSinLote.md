# SP: pValidarLoteDocumentoSinLote
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArtCompuestoGen`](../tables/saArtCompuestoGen.md)
- [`saArtCompuestoGenReng`](../tables/saArtCompuestoGenReng.md)
- [`saDevolucionClienteReng`](../tables/saDevolucionClienteReng.md)
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saFacturaCompraReng`](../tables/saFacturaCompraReng.md)
- [`saFacturaVentaReng`](../tables/saFacturaVentaReng.md)
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarLoteDocumentoSinLote]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(512) )

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                r.rowguid, R.ajue_num AS nro_doc, R.reng_num, 'AJUS' AS tipo_doc, 'saAjusteReng' AS NameTabla
            FROM
                saAjusteReng R
            WHERE
                R.lote_asignado = 1
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saLoteEntrada L
                                 WHERE
                                    R.rowguid = L.rowguid_reng
                                    AND L.tipo_doc IN ( 'AJUE', 'AJUS' ) )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saLoteSalida L
                                 WHERE
                                    R.rowguid = L.rowguid_reng
                                    AND L.tipo_doc IN ( 'AJUE', 'AJUS' ) )
            UNION
            SELECT
                r.rowguid, R.tras_num AS nro_doc, R.reng_num, 'TRAS' AS tipo_doc, 'saTrasladoReng' AS NameTabla
            FROM
                saTrasladoReng R
            WHERE
                R.lote_asignado = 1
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saLoteEntrada L
                                 WHERE
                                    L.tipo_doc IN ( 'TRAE', 'TRAS' )
                                    AND R.rowguid = L.rowguid_reng )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saLoteSalida L
                                 WHERE
                                    L.tipo_doc IN ( 'TRAE', 'TRAS' )
                                    AND R.rowguid = L.rowguid_reng )
            UNION
            --SELECT
            --    r.rowguid, R.gene_num AS nro_doc, R.reng_num, 'RGEN' AS tipo_doc, 'saArtCompuestoGenReng' AS NameTabla
            --FROM
            --    saArtCompuestoGenReng R
            --WHERE
            --
```
