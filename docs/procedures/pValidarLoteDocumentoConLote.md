# SP: pValidarLoteDocumentoConLote
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
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
CREATE PROCEDURE [dbo].[pValidarLoteDocumentoConLote]
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
                R.rowguid, R.ajue_num AS nro_doc, R.reng_num, 'AJUS' AS tipo_doc, 'saAjusteReng' AS NameTabla
            FROM
                saAjusteReng R
                LEFT JOIN saLoteEntrada LE ON R.rowguid = LE.rowguid_reng
                                              AND LE.tipo_doc IN ( 'AJUE', 'AJUS' )
                LEFT JOIN saLoteSalida LS ON R.rowguid = LS.rowguid_reng
                                             AND LS.tipo_doc IN ( 'AJUE', 'AJUS' )
            WHERE
                R.lote_asignado = 0
                /*AND ( LE.rowguid_reng IS NOT NULL
                      OR LS.rowguid_reng IS NOT NULL
                    )*/ --DN 241022
                AND ( (LE.rowguid_reng IS NOT NULL and le.cantidad = dbo.ArtUnidadBase(r.Co_Art, r.Co_Uni, r.total_art))
                      OR (LS.rowguid_reng IS NOT NULL and ls.cantidad = dbo.ArtUnidadBase(r.Co_Art, r.Co_Uni, r.total_art))
                    )
            UNION
            SELECT
                R.rowguid, R.tras_num AS nro_doc, R.reng_num, 'TRAS' AS tipo_doc, 'saTrasladoReng' AS NameTabla
            FROM
                saTrasladoReng R
                LEFT JOIN saLoteEntrada LE ON R.rowguid = LE.rowguid_reng
                                              AND LE.tipo_doc IN ( 'TRAE', 'TRAS' )
                LEFT JOIN saLoteSalida LS ON R.rowguid = LS.rowguid_reng
                                             AND LS.tipo_doc IN ( 'TRAE', 'TRAS' )
            WHERE
                R.lote_asignado = 0
                /*AND ( LE.rowguid_reng IS NOT NULL
                      OR LS.rowguid_reng IS NOT NULL
                    )*/ --DN 241022
                AND ( (LE.rowguid_reng IS NOT NULL and le.cantidad = dbo.ArtUnidadBase(r.Co_Art, r.Co_Uni, r.total_art))
                      OR (LS.rowguid_reng IS NOT NULL and ls.cantidad = dbo.ArtUnidadBase(r.Co_Art, r.Co_Uni, r.total_art))
                    )
            UNION
            SELECT
                R.rowguid, R.gene_num AS nro_doc, R.reng_num, 'RGEN' AS tipo_doc, 'saArtCompuestoGenReng' AS NameTabla
            FROM
                saArtCom
```
