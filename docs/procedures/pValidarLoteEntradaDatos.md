# SP: pValidarLoteEntradaDatos
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
- [`saNotaEntregaVentaReng`](../tables/saNotaEntregaVentaReng.md)
- [`saNotaRecepcionCompraReng`](../tables/saNotaRecepcionCompraReng.md)
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarLoteEntradaDatos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN    
       
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(512) )
        DECLARE @TipoDoc CHAR(4)
        DECLARE @AjueNum CHAR(20)
        DECLARE @CoArtL CHAR(30)
        DECLARE @CoArtR CHAR(30)
        DECLARE @CoAlmaL CHAR(6)
        DECLARE @CoAlmaR CHAR(6)

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                L.rowguid, L.tipo_doc, R.ajue_num, L.co_art, R.co_art, L.co_alma, R.co_alma
            FROM
                saLoteEntrada L
                INNER JOIN saAjusteReng R ON R.rowguid = L.rowguid_reng
            WHERE
                L.tipo_doc IN ( 'AJUS' )
                AND ( R.co_art <> L.CO_ART
                      OR R.co_alma <> L.co_alma
                    )
            UNION
   --         SELECT
   --             L.rowguid, L.tipo_doc, R.tras_num, L.co_art, R.co_art, L.co_alma, E.alm_tmp
   --         FROM
   --             saLoteEntrada L
   --             INNER JOIN saTrasladoReng R ON R.rowguid = L.rowguid_reng
   --             INNER JOIN saTraslado E ON E.tras_num = R.tras_num
   --         WHERE
   --             L.tipo_doc IN ( 'TRAE', 'TRAS' )
   --             AND ( R.co_art <> L.CO_ART
   --                   OR E.alm_orig <> L.co_alma
   --                 )
   --        UNION
            SELECT
                L.rowguid, L.tipo_doc, R.tras_num, L.co_art, R.co_art, L.co_alma, E.alm_dest
            FROM
                saLoteEntrada L
                INNER JOIN saTrasladoReng R ON R.rowguid = L.rowguid_reng
                INNER JOIN saTraslado E ON E.tras_num = R.tras_num
            WHERE
                L.tipo_doc IN ( 'TRAE', 'TRAS' )
                AND E.confirma = 1
                AND ( R.co_art <> L.CO_ART
                      OR E.alm_dest <> L.co_alma
                    )
            UNION
            SELECT
                L.rowguid, L.tipo_doc, R.doc_num, L.co_art, R.co_art, L.co_alma, R.co_alma
            FROM
                saLoteEntrada L
                INNER JOIN saFacturaVentaReng R ON R.rowguid = L.rowguid_reng
            WHERE
                L.tipo_doc IN ( 'FACT' )
                AND ( R.co_art <> L.CO_ART
                      OR R.co_alma <> L.co_alma
                    )
            UNION
```
