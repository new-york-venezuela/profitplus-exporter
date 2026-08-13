# Tabla: saArticulo
**Módulo**: Inventario
**Descripción de Negocio**: Catálogo maestro de artículos (productos y servicios). Es la tabla de referencia central para todo movimiento de inventario, facturación y compras. Define atributos del artículo: clasificación, impuestos, stock min/max, manejo de seriales/lotes y márgenes.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_art` | char | NOT NULL | Código del artículo (PK) | Clave Primaria |
| `art_des` | varchar | NULL | Descripción del artículo | — |
| `tipo` | char | NULL | `M`=mercancía, `S`=servicio, `K`=kit/compuesto | — |
| `anulado` | bit | NULL | `1` = artículo inactivo/eliminado | — |
| `co_lin` | char | NULL | Línea del artículo | FK Implícita → `saLineaArticulo.co_lin` |
| `co_subl` | char | NULL | Sub-línea | FK Implícita → `saSubLinea.co_subl` |
| `co_cat` | char | NULL | Categoría | FK Implícita → `saCatArticulo.co_cat` |
| `co_color` | char | NULL | Color | FK Implícita → `saColor.co_color` |
| `co_ubicacion` | char | NULL | Ubicación en almacén | FK Implícita → `saUbicacion.co_ubicacion` |
| `modelo` | varchar | NULL | Modelo o referencia del artículo | — |
| `ref` | varchar | NULL | Referencia adicional | — |
| `generico` | bit | NULL | `1` = artículo genérico (sin control de serial) | — |
| `maneja_serial` | bit | NULL | `1` = requiere número de serial para entradas/salidas | — |
| `maneja_lote` | bit | NULL | `1` = maneja lotes de producción | — |
| `maneja_lote_venc` | bit | NULL | `1` = lotes con fecha de vencimiento | — |
| `tipo_imp` | char | NULL | Tipo de impuesto IVA: `1`=gravado, `E`=exento, `0`=no aplica | FK → `saImpuesto` |
| `tipo_imp2` | char | NULL | Tipo impuesto suntuario (8%) | — |
| `co_reten` | char | NULL | Código de retención ISLR si el artículo genera retención | FK → `saConISLR` |
| `stock_min` | decimal | NULL | Stock mínimo (punto de reorden) | — |
| `stock_max` | decimal | NULL | Stock máximo | — |
| `stock_pedido` | decimal | NULL | Cantidad de reorden sugerida | — |
| `margen_min` | decimal | NULL | Margen mínimo de ganancia (%) | — |
| `margen_max` | decimal | NULL | Margen máximo de ganancia (%) | — |
| `tipo_cos` | char | NULL | Método de costeo: `P`=promedio, `F`=FIFO, `L`=LIFO | — |
| `peso` | decimal | NULL | Peso en kg | — |
| `volumen` | decimal | NULL | Volumen en m³ | — |
| `punt_ven` | decimal | NULL | Puntos para programa de fidelidad al vender | — |
| `punt_cli` | decimal | NULL | Puntos requeridos para canje por clientes | — |
| `prec_om` | bit | NULL | `1` = precio en moneda original (USD) | — |
| `reten_iva_tercero` | char | NULL | Indica retención IVA a terceros | — |
| `campo1`-`campo8` | varchar | NULL | Campos personalizables adicionales | — |

## Triggers Relacionados
- `ValidarsaArtCrearAut`: valida reglas al crear artículo automáticamente

## Relaciones Clave
- **Stock por almacén**: `saStockAlmacen` (co_art)
- **Precios**: `saArtPrecio` (co_art)
- **Facturas de venta**: `saFacturaVentaReng.co_art`
- **Facturas de compra**: `saFacturaCompraReng.co_art`
- **Ajustes inventario**: `saAjusteReng.co_art`

## Recetario SQL de Negocio
```sql
-- Artículos con stock bajo mínimo
SELECT a.co_art, a.art_des, s.co_alma,
       s.stock, a.stock_min,
       a.stock_min - s.stock AS deficit
FROM saArticulo a
INNER JOIN saStockAlmacen s ON a.co_art = s.co_art
WHERE s.stock < a.stock_min AND a.anulado = 0
ORDER BY deficit DESC;

-- Artículos activos con precios vigentes en USD
SELECT a.co_art, a.art_des, p.co_precio, p.monto AS precio_bs,
       p.co_mone, p.monto / NULLIF(t.tasa_v, 0) AS precio_usd
FROM saArticulo a
INNER JOIN saArtPrecio p ON a.co_art = p.co_art
LEFT JOIN (SELECT co_mone, MAX(fecha) AS ultima FROM saTasa
           GROUP BY co_mone) lf ON lf.co_mone = 'USD'
LEFT JOIN saTasa t ON t.co_mone = 'USD' AND t.fecha = lf.ultima
WHERE a.anulado = 0
  AND (p.hasta IS NULL OR p.hasta >= GETDATE())
ORDER BY a.co_lin, a.co_art;
```
