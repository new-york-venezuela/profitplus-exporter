# Tabla: saStockAlmacen
**Módulo**: Inventario
**Descripción de Negocio**: Stock actual por almacén y artículo. Tabla de 7 columnas, desnormalizada por diseño para máxima velocidad de lectura. Es el balance de inventario en tiempo real: cada `(co_alma, co_art)` tiene exactamente una fila. Los movimientos de entrada/salida la actualizan vía triggers o SPs. Para histórico usar `saCostoHistoricoEntrada`/`saCostoHistoricoSalida`.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_alma` | char | NOT NULL | Código del almacén (PK con co_art) | FK → `saAlmacen.co_alma` |
| `co_art` | char | NOT NULL | Código del artículo (PK con co_alma) | FK → `saArticulo.co_art` |
| `tipo` | char | NULL | Tipo de stock: `E`=existencia, `A`=apartado | — |
| `stock` | decimal | NULL | **Cantidad en existencia actual** | — |
| `revisado` | char | NULL | Flag de sincronización replicación | — |
| `trasnfe` | char | NULL | Flag de transferencia multiempresa | — |
| `validador` | timestamp | NULL | Timestamp para control de concurrencia optimista | — |

## Recetario SQL de Negocio
```sql
-- Inventario valorizado al costo promedio
SELECT
    s.co_alma, al.des_alma,
    s.co_art, a.art_des, a.co_lin,
    s.stock,
    s.stock * ISNULL(cp.costo_prom, 0)         AS valor_bs,
    s.stock * ISNULL(cp.costo_prom, 0)
        / NULLIF((SELECT TOP 1 tasa_v FROM saTasa
                  WHERE co_mone='USD' ORDER BY fecha DESC), 0) AS valor_usd
FROM saStockAlmacen s
INNER JOIN saArticulo a ON s.co_art = a.co_art
INNER JOIN saAlmacen al ON s.co_alma = al.co_alma
LEFT JOIN (
    SELECT co_art, co_alma, AVG(cost_unit) AS costo_prom
    FROM saFacturaCompraReng fcr
    INNER JOIN saFacturaCompra fc ON fcr.doc_num = fc.doc_num
    WHERE fc.anulado = 0
    GROUP BY co_art, co_alma
) cp ON cp.co_art = s.co_art AND cp.co_alma = s.co_alma
WHERE s.stock > 0 AND a.anulado = 0
ORDER BY s.co_alma, a.co_lin, a.co_art;
```
