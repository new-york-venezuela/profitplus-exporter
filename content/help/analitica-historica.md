# Analítica histórica

Esta sección muestra las ventas y devoluciones del **sistema anterior** (enero 2020 – febrero 2026), con las mismas reglas que la Analítica actual. Los clientes, productos y vendedores del sistema anterior son identidades independientes de las actuales: no se pueden cruzar ni sumar con las cifras de marzo de 2026 en adelante.

## Cómo se calcula

- **Ventas brutas**: suma de las líneas de factura sin IVA, antes de devoluciones, sin facturas anuladas.
- **Devoluciones**: líneas de notas de crédito sin IVA. Por defecto se asignan a la **fecha de la devolución**; con el selector se puede usar la **fecha de la factura original**. Una devolución cuya factura no se pudo identificar se cuenta en su propia fecha.
- **Ventas netas** = ventas brutas − devoluciones. Pueden ser negativas (por ejemplo, un cliente que solo tuvo devoluciones en el período).
- **Tasa de devolución** = devoluciones ÷ ventas brutas (Bs).
- **USD**: cada monto se convierte con la tasa del sistema anterior para su fecha (las devoluciones, con la tasa de la fecha de la factura original). Si no hay tasa, se muestra **Sin datos**; nunca $0.

## Clientes: casa matriz y tiendas

Como en la Analítica actual, un **cliente** es una **casa matriz** (la entidad legal) y sus **tiendas** son los códigos de cliente que cuelgan de ella. Ventas, Devoluciones y Clientes agrupan por casa matriz por defecto; el selector **Casa matriz | Tienda** cambia a una fila por tienda. Los conteos "Clientes" son casas matriz y "Tiendas" son códigos de cliente. Un cliente sin casa matriz cuenta como su propio cliente.

## Fechas

- **Atajos** (cada botón dice qué período elige, contado desde el **final de los datos históricos**, febrero 2026, no desde hoy): "Último mes", "Último trimestre", "12 meses", "Último año", "Año anterior" y "Todo". El último año y el año anterior son años calendario completos; no hay "año a la fecha".
- **Año**: todos los años de los datos (2020 a 2026); el último solo llega hasta donde hay datos.
- **Trimestre** (T1 a T4) y **Mes**: los del año seleccionado; los que no tienen datos aparecen deshabilitados. ◀ ▶ junto a los meses recorren mes a mes, incluso al cambiar de año.
- **Flechas ◀ ▶ junto a los años**: pasan al **mismo período** del año anterior o siguiente, para comparar igual contra igual: un mes sigue siendo ese mes, un trimestre ese trimestre, y un rango personalizado o los últimos 12 meses se desplazan exactamente un año.
- **Personalizado**: cualquier rango entre enero 2020 y febrero 2026.

## Pestañas

- **Resumen**: ventas brutas, devoluciones y neto del período, y su tendencia.
- **Ventas**: por cliente, línea (con detalle por producto), vendedor o período.
- **Devoluciones**: por cliente, producto o período.
- **Clientes**: actividad de cada cliente (casa matriz o tienda), con cuántas de sus tiendas compraron, primera y última compra, y clase Pareto (A/B/C). "Sin compras en el período" = no compró en el rango elegido.
- **Productos**: tabla por línea, sublínea o SKU, con Pareto, tasa de devolución, unidades por mes y variación frente al período anterior. "Alcance" cuenta clientes (casas matriz) y tiendas.
- **Vendedores**: ventas por el vendedor del documento; muestra clientes y tiendas atendidos; "Sin vendedor" agrupa los documentos sin vendedor. Haga clic en un vendedor para ver su tendencia.

No hay cuentas por cobrar, compras, finanzas ni metas del sistema anterior.
