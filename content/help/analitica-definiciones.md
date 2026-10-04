# Definiciones de Analítica

Todas las cifras de Analítica salen del Data Warehouse, que se actualiza desde Profit Plus. Los montos son **sin IVA** salvo que se indique lo contrario.

## Ventas brutas

Suma de las líneas de factura de venta del período:

- **Sin IVA.** El IVA no forma parte de la venta.
- **Sin facturas anuladas.**
- **Netas de descuentos**, tanto el de línea como el descuento global de la factura.
- **Por fecha de la factura.** Se toma el día de emisión, sin importar la hora.
- **Antes de devoluciones.**

## Devoluciones

Suma de las líneas de devolución de clientes (módulo de devoluciones de Profit), sin IVA y sin las anuladas. Cada línea está enlazada a la factura que devuelve, así que una devolución se puede ubicar de dos formas:

- **Por fecha de factura** (la opción por defecto). La devolución resta del período de su factura original. Así, las ventas netas de un mes cuadran con un cálculo hecho factura por factura. Un mes ya cerrado puede cambiar si después llega una devolución de una de sus facturas.
- **Por fecha de devolución.** La devolución cuenta en el período en que se emitió la nota de crédito. La pestaña Devoluciones y las tasas de devolución que aparecen solas usan esta fecha, y lo indican.

En la pestaña Ventas puede escoger cualquiera de las dos con el selector **Devoluciones**.

## Ventas netas

**Ventas netas = Ventas brutas − Devoluciones**, con las devoluciones por fecha de factura (o según el selector de la pestaña Ventas).

En la pestaña **Histórico 2025** las devoluciones no están enlazadas a su factura, así que allí se restan por fecha de devolución.

## Tasa de devolución

Devoluciones ÷ ventas brutas. Cuando aparece junto a las ventas netas, usa las mismas devoluciones de esa tabla. En la pestaña Devoluciones usa las devoluciones por fecha de devolución.

## Qué no está incluido

- **Notas de crédito hechas fuera del módulo de devoluciones.** Esto incluye descuentos, correcciones de precio, consignación y devoluciones cargadas como nota de crédito simple. Hoy no restan de las ventas en ninguna pestaña.
- **El recargo por diferencial cambiario** de las devoluciones.
- **Notas de débito.**

## Montos en USD

Cada línea se convierte a la tasa de venta de **su propia fecha**, no a la tasa de hoy. Los días sin tasa publicada (fines de semana y feriados) usan la última tasa anterior. Las devoluciones se convierten a la tasa de la **fecha de su factura original**, porque su monto en bolívares es el precio de esa factura.

En **Finanzas**, los movimientos anteriores a la primera tasa registrada no tienen tasa histórica. Esos movimientos no se suman en USD, y la pestaña indica el monto que quedó fuera.

## Vendedores y consignación

La pestaña **Vendedores** y el perfil del vendedor excluyen las facturas emitidas a la raíz de una cadena con patrón de consignación, porque no se puede saber qué vendedor generó esa venta. El monto excluido aparece en su propia columna. **Resumen** y **Matriz Vendedor-Producto** sí incluyen esas facturas, así que sus totales por vendedor son mayores.

## Cobranza, DSO y tasa de cobranza

La cobranza y el saldo por cobrar incluyen IVA. Por eso la **Tasa cobr.** y el **DSO** se comparan contra las ventas **con IVA**:

- **Tasa cobr.:** cobrado ÷ ventas con IVA.
- **DSO:** saldo ÷ (ventas con IVA − devoluciones con IVA de los 90 días previos) × 90.

## Finanzas

- **Ingresos operativos** son las ventas netas del período.
- **Utilidad bruta (proxy)** resta las compras como aproximación del costo, porque Profit no registra el costo de producto.
- **Resultado después de intereses e impuestos** es el margen operativo menos los intereses y los impuestos pagados por caja. No es la utilidad neta contable.

## Mapa de clientes

**Ingresos** en el mapa son las ventas brutas, solo de los clientes activos en Profit y agrupadas por código de tienda. Por eso no coinciden con los totales de Analítica. El segmento A/B/C también puede diferir, porque Analítica lo calcula por entidad.

## Cómo cuadrar con un Excel de Profit

Para que un Excel cuadre con las ventas netas de Analítica:

1. Excluya las facturas y devoluciones anuladas.
2. Use montos sin IVA: la base de cada línea, no el total neto con IVA del documento.
3. Reste el descuento global de la factura.
4. Filtre por fecha de factura e incluya todo el último día. Las fechas tienen hora, así que un filtro `BETWEEN '…-01' AND '…-30'` deja fuera las facturas del 30 después de medianoche.
5. Reste solo las devoluciones del módulo de devoluciones, ubicadas en el mes de su factura original.
