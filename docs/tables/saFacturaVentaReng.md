# Tabla: saFacturaVentaReng
**Módulo**: Ventas
**Descripción de Negocio**: Renglones (líneas de detalle) de facturas de venta. Cada fila es un artículo dentro de una factura. Almacena cantidades, precios, descuentos e impuestos a nivel de artículo. Se une a `saFacturaVenta` por `doc_num`.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón dentro de la factura (PK compuesta) | PK (con doc_num) |
| `doc_num` | char | NOT NULL | Número de factura al que pertenece | FK → `saFacturaVenta.doc_num` |
| `co_art` | char | NULL | Código del artículo vendido | FK Implícita → `saArticulo.co_art` |
| `des_art` | varchar | NULL | Descripción del artículo al momento de venta (puede diferir del catálogo) | — |
| `co_alma` | char | NULL | Almacén desde donde salió el inventario | FK Implícita → `saAlmacen.co_alma` |
| `total_art` | decimal | NULL | Cantidad vendida en la unidad base | — |
| `stotal_art` | decimal | NULL | Cantidad en unidad secundaria (si el artículo maneja dos unidades) | — |
| `co_uni` | char | NULL | Unidad de medida principal | FK Implícita → `saUnidad.co_uni` |
| `co_precio` | char | NULL | Código de lista de precio aplicada | FK Implícita → `saTipoPrecio` |
| `prec_vta` | decimal | NULL | Precio de venta unitario en moneda del documento | — |
| `prec_vta_om` | decimal | NULL | Precio de venta unitario en moneda original del precio | — |
| `porc_desc` | varchar | NULL | Porcentaje de descuento por línea | — |
| `monto_desc` | decimal | NULL | Monto de descuento por línea | — |
| `tipo_imp` | char | NULL | Código de impuesto 1 (ej: `1`=IVA 16%, `E`=Exento) | FK → `saImpuestoReng` |
| `tipo_imp2` | char | NULL | Código de impuesto 2 (suntuario 8%) | — |
| `tipo_imp3` | char | NULL | Código de impuesto 3 | — |
| `porc_imp` | decimal | NULL | Porcentaje del impuesto 1 aplicado | — |
| `monto_imp` | decimal | NULL | Monto del impuesto 1 calculado | — |
| `monto_imp2` | decimal | NULL | Monto del impuesto 2 | — |
| `monto_imp3` | decimal | NULL | Monto del impuesto 3 | — |
| `reng_neto` | decimal | NULL | Neto del renglón: (precio × cantidad) - descuentos + impuestos | — |
| `pendiente` | decimal | NULL | Cantidad pendiente de despachar (para órdenes parciales) | — |
| `total_dev` | decimal | NULL | Total devuelto de este renglón | — |
| `monto_dev` | decimal | NULL | Monto devuelto de este renglón | — |
| `tipo_doc` | char | NULL | Tipo del documento de referencia (orden, cotización) | — |
| `num_doc` | varchar | NULL | Número del documento de referencia | — |
| `monto_desc_glob` | decimal | NULL | Parte del descuento global prorrateada en este renglón | — |
| `monto_reca_glob` | decimal | NULL | Parte del recargo global prorrateado en este renglón | — |
| `lote_asignado` | bit | NULL | `1` = lote de inventario ya asignado al renglón | — |

## Triggers Relacionados
_Ninguno_ (el trigger de la cabecera gestiona el inventario vía `saStockAlmacen`)

## Recetario SQL de Negocio
```sql
-- Top artículos vendidos en el mes (en unidades y Bs)
SELECT
    r.co_art,
    a.art_des,
    SUM(r.total_art)    AS cant_total,
    SUM(r.reng_neto)    AS monto_bs,
    SUM(r.reng_neto / NULLIF(f.tasa, 0)) AS monto_usd
FROM saFacturaVentaReng r
INNER JOIN saFacturaVenta f ON r.doc_num = f.doc_num
LEFT JOIN  saArticulo a     ON r.co_art  = a.co_art
WHERE f.fec_emis BETWEEN '2024-01-01' AND '2024-01-31'
  AND f.anulado = 0
GROUP BY r.co_art, a.art_des
ORDER BY monto_usd DESC;

-- Detalle de facturas con impuestos desglosados
SELECT
    f.doc_num, f.n_control, f.fec_emis,
    r.co_art, r.des_art, r.total_art,
    r.prec_vta, r.monto_imp AS iva, r.reng_neto
FROM saFacturaVenta f
INNER JOIN saFacturaVentaReng r ON f.doc_num = r.doc_num
WHERE f.anulado = 0
ORDER BY f.fec_emis DESC, f.doc_num, r.reng_num;
```
