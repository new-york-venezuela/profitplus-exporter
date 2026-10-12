# Definiciones de Analítica

Todas las cifras de Analítica salen del Data Warehouse, que se actualiza desde Profit Plus. Los montos son **sin IVA** salvo que se indique lo contrario.

## Ritmo del mes

**Ritmo del mes** (Resumen): días laborables transcurridos del mes de referencia (el mes en que termina el rango elegido) y el porcentaje del mes. Solo se excluyen sábados y domingos; los feriados no se consideran.

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

## Productos

La pestaña **Productos** baja de **línea** a **sublínea** (Artesanal / Industrial) y de ahí a **producto**. La **categoría** (Fresco / Congelado) es un filtro, no un nivel: al elegirla, todas las tablas y gráficos de la pestaña se limitan a esa categoría.

- **Participación por grupo de cliente:** para cada fila del nivel actual, el porcentaje de sus ventas brutas (sin IVA) que va a cada grupo de cliente. Cada venta se asigna al grupo **actual** del cliente; los clientes sin grupo aparecen en "Sin grupo". Un "—" significa que ese grupo no compró esa fila. Pasar el cursor sobre una celda muestra el monto.
- **Presencia y profundidad por producto:** clientes y tiendas que compraron el producto y su porcentaje sobre los clientes y tiendas activos del período (la categoría no reduce ese denominador). *Primera línea* = lo compra el 70% o más de los clientes activos; *Segunda línea* = 30% o más; *Addon* = menos. La tasa de devolución usa la fecha de la devolución.

## Cobertura de clientes

La última venta y los promedios de la sección "Cobertura de clientes" no dependen del período seleccionado; solo "Sin compras en el período" y "Clientes nuevos" usan el rango de fechas.

- **Última venta:** la fecha de la última factura (sin anuladas) en todo el histórico. "Sin datos" significa que no existe ninguna factura para ese cliente.
- **USD/mes y Unidades/mes:** promedio de los últimos 12 meses calendario (el mes en curso incluido), calculado **solo sobre los meses en que el cliente tuvo facturas**. Un cliente que compró en enero, marzo y abril se promedia entre 3. Ventas brutas, sin IVA, en USD a la tasa de cada factura.
- **Estados:** *Nunca vendido* (ni el cliente ni su entidad tienen facturas), *Vende vía matriz* (el cliente no tiene facturas propias pero otra tienda de su misma entidad sí), *Sin ventas 30+ días* (última venta hace más de 30 días) y *Activo*.
- **Vendedor:** el vendedor por defecto actual del cliente.
- **Versiones del cliente:** se muestra solo la versión vigente (nombre y vendedor actuales); las ventas se suman sobre todas las versiones del mismo código.
- Los clientes inactivos se excluyen salvo que se marque "Incluir inactivos".
- **Orden por Días sin vender (ascendente):** primero los "Sin datos", luego los de más días sin vender, hasta los más recientes.
- **Grupo y ruta:** salen de la ficha actual del cliente en Profit Plus (grupo = segmento del cliente; ruta = zona de ruta). Los filtros de arriba de la pestaña aplican a toda la pestaña; en Entidad, las devoluciones se atribuyen a la entidad completa.
- **Visita vencida:** el cliente lleva más días sin comprar que su frecuencia de visita (semanal 7, quincenal 15, mensual 30). Un cliente sin frecuencia asignada muestra "Sin frecuencia" y nunca figura como vencido. El cumplimiento es al día ÷ (al día + vencidas).
- **Sin compras en el período:** clientes asignados (no inactivos) sin ninguna factura, sin anuladas, en el rango de fechas elegido.
- **Tipo:** *Patrimonio* = registrado antes del año del rango o en el lote migrado en la puesta en marcha (28/03/2026); *Nuevo* = registrado en el año del rango, fuera de ese lote. Sin fecha de registro se muestra "—".

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

## Seguimiento

La pestaña **Seguimiento** replica el cuadro de seguimiento por ruta: para un mes muestra, por **vendedor**, **ruta** o **grupo de cliente**, la activación semanal, el avance contra la meta con su proyección, el precio promedio, la mezcla por línea y los clientes nuevos. Haga clic en un vendedor, ruta o grupo para ver sus clientes y en un cliente para ver sus líneas de factura. El botón **Tabla** muestra lo mismo en forma de tabla.

- **Mes de referencia:** el mes en que termina el rango de fechas elegido (con "30 días" o "12 meses", el mes actual). Las ventas y la meta son de ese mes, hasta hoy.
- **Ventas:** ventas brutas sin IVA, antes de devoluciones, sin la facturación agregada de consignación (que se lista aparte, igual que antes en Vendedores).
- **Cliente asignado:** el cliente pertenece al vendedor, ruta o grupo que tiene hoy en su ficha del ERP; las facturas antiguas siguen al cliente. Los clientes inactivos no cuentan.
- **Cliente activo en una semana:** tuvo al menos una factura esa semana ISO (lunes a domingo, aunque la semana empiece en el mes anterior). Porcentaje = clientes activos ÷ clientes asignados.
- **Proyección:** ventas del mes ÷ (días laborables transcurridos ÷ días laborables del mes). Solo se excluyen sábados y domingos; los feriados no se consideran.
- **Meta:** las metas se definen por vendedor (botón "Editar metas" en la tarjeta del vendedor). Para rutas y grupos es la suma de las metas de sus vendedores; si un vendedor atiende varias rutas, la meta aparece como "compartida" porque no se reparte entre ellas.
- **Precio promedio:** ventas ÷ unidades vendidas del período (las unidades de distintas líneas se suman tal como se facturan).
- **Mezcla por línea:** participación de cada línea de producto en las ventas; las líneas se leen de Profit Plus, de modo que una línea nueva aparece sola cuando tenga ventas. Las líneas menores se agrupan en "Otros".
- **Clientes nuevos:** clientes registrados en el mes, sin contar el lote de clientes migrado en la puesta en marcha, frente a la meta de clientes nuevos.
- **Visita vencida:** el cliente lleva más días sin comprar que su frecuencia de visita (semanal 7, quincenal 15, mensual 30). Un cliente sin frecuencia asignada nunca figura como vencido ("Sin frecuencia").

## Cómo cuadrar con un Excel de Profit

Para que un Excel cuadre con las ventas netas de Analítica:

1. Excluya las facturas y devoluciones anuladas.
2. Use montos sin IVA: la base de cada línea, no el total neto con IVA del documento.
3. Reste el descuento global de la factura.
4. Filtre por fecha de factura e incluya todo el último día. Las fechas tienen hora, así que un filtro `BETWEEN '…-01' AND '…-30'` deja fuera las facturas del 30 después de medianoche.
5. Reste solo las devoluciones del módulo de devoluciones, ubicadas en el mes de su factura original.
