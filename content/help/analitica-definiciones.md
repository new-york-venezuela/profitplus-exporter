# Definiciones de Analítica

Todas las cifras de Analítica salen del Data Warehouse, que se actualiza desde Profit Plus. Los montos son **sin IVA** salvo que se indique lo contrario.

## Ventas brutas

Suma de las líneas de factura de venta del período:

- **Sin IVA.** El IVA no forma parte de la venta.
- **Sin facturas anuladas.**
- **Netas de descuentos**, tanto el de línea como el descuento global de la factura.
- **Por fecha de la factura.** Se toma el día de emisión, sin importar la hora.
- **Antes de devoluciones.**

## Unidades vendidas

Suma de las cantidades facturadas en el período, sin facturas anuladas y antes de devoluciones. Es la misma cifra que muestra la pestaña Ventas. En "Desempeño por vendedor" cuenta todas las facturas del vendedor, incluida la consignación.

## Pendiente por cobrar

Saldo total pendiente de cobro (todas las facturas con saldo, sin notas de crédito) según el snapshot de CxC más reciente **al último día del período seleccionado**. La tarjeta indica la fecha real del snapshot ("al 28/09/2026"). Si no existe un snapshot a esa fecha o antes, muestra "Sin datos". En USD se valora a la tasa de la fecha del snapshot.

## Cobertura de clientes

La sección "Cobertura de clientes" de la pestaña Clientes **no depende del período seleccionado**, para no perder datos por un filtro de fechas.

- **Última venta:** la fecha de la última factura (sin anuladas) en todo el histórico. "Sin datos" significa que no existe ninguna factura para ese cliente.
- **USD/mes y Unidades/mes:** promedio de los últimos 12 meses calendario (el mes en curso incluido), calculado **solo sobre los meses en que el cliente tuvo facturas**. Un cliente que compró en enero, marzo y abril se promedia entre 3. Ventas brutas, sin IVA, en USD a la tasa de cada factura.
- **Estados:** *Nunca vendido* (ni el cliente ni su entidad tienen facturas), *Vende vía matriz* (el cliente no tiene facturas propias pero otra tienda de su misma entidad sí), *Sin ventas 30+ días* (última venta hace más de 30 días) y *Activo*.
- **Vendedor:** el vendedor por defecto actual del cliente.
- **Versiones del cliente:** se muestra solo la versión vigente (nombre y vendedor actuales); las ventas se suman sobre todas las versiones del mismo código.
- Los clientes inactivos se excluyen salvo que se marque "Incluir inactivos".
- **Orden por Días sin vender (ascendente):** primero los "Sin datos", luego los de más días sin vender, hasta los más recientes.

## Ventas por cliente

La tabla siempre está agrupada por **Entidad** (cadena o razón social). Cada Entidad se puede abrir ("▸") para ver sus **tiendas**, y cada tienda para ver sus **productos**. Las filas hijas usan las mismas columnas y unidades que la tabla principal (ventas brutas, devoluciones, ventas netas, unidades, tasa de devolución, descuento), por lo que las tiendas suman exactamente la Entidad y los productos suman su tienda. Una Entidad con una sola tienda también se puede abrir.

La gráfica "Tendencia de ventas" muestra **unidades** por defecto, ya que el dinero se ve en Resumen; el selector "Unidades | Dinero" cambia la métrica.

## Devoluciones

Suma de las líneas de devolución de clientes (módulo de devoluciones de Profit), sin IVA y sin las anuladas. Cada línea está enlazada a la factura que devuelve, así que una devolución se puede ubicar de dos formas:

- **Por fecha de factura** (la opción por defecto). La devolución resta del período de su factura original. Así, las ventas netas de un mes cuadran con un cálculo hecho factura por factura. Un mes ya cerrado puede cambiar si después llega una devolución de una de sus facturas.
- **Por fecha de devolución.** La devolución cuenta en el período en que se emitió la nota de crédito. La pestaña Devoluciones y las tasas de devolución que aparecen solas usan esta fecha, y lo indican.

En la pestaña Ventas puede escoger cualquiera de las dos con el selector **Devoluciones**.

**Indicadores de la pestaña Devoluciones.** Todos usan la fecha de la nota de crédito y comparan contra las ventas brutas del mismo período: *Devoluciones netas*, *Tasa de devolución* (devoluciones ÷ ventas brutas), *Unidades devueltas* (y su proporción sobre las unidades vendidas), *Notas de crédito* (cantidad y promedio), *Producto más devuelto*, *Cliente con más devoluciones* (por Entidad) y *Mayor tasa por vendedor* (solo vendedores con al menos 1% de las ventas brutas del período, para que un vendedor con una sola factura no encabece la lista).

## Ventas netas

**Ventas netas = Ventas brutas − Devoluciones**, con las devoluciones por fecha de factura (o según el selector de la pestaña Ventas).

La pestaña **Histórico 2025** sigue la misma regla (devoluciones por fecha de la factura original); las devoluciones de facturas anteriores a enero 2025 quedan fuera de esa pestaña.

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

**Tendencias de CxC.** El DSO y la antigüedad de saldos en el tiempo siguen el período seleccionado y el mismo criterio de agrupación que Resumen y Ventas: por día o semana si el período es de hasta un mes, por semana si es de hasta un año y por mes en los demás casos. Cada punto es el **último snapshot de cuentas por cobrar dentro de ese día, semana o mes**; los períodos sin snapshot no se dibujan (no se interpola). El detalle de la fecha del snapshot aparece al pasar el cursor.

**Vencido y al corriente.** *Vencido* es todo saldo que ya pasó su fecha de vencimiento (tramos 1-30, 31-60, 61-90 y >90 días); *al corriente* es el que aún no vence. En el Top 10 de concentración de crédito, vencido + al corriente = saldo.

**Concentración de deuda por cliente (Top 15).** Se escoge y se ordena por **saldo vencido** (de mayor a menor; a igual vencido, por saldo total), no por saldo total: así un cliente con mucha deuda pero sin vencimientos no desplaza a quienes hay que cobrar primero. En cada barra, lo rojo ya venció (más oscuro = más antiguo, empezando desde el eje) y lo gris aún no vence.

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
