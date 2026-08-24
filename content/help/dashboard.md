## ¿Qué es esta página?

Muestra los artículos que están en riesgo de quedarse sin stock pronto,
según su ritmo de venta reciente. La idea es que puedas revisar esta
lista periódicamente y decidir qué reabastecer antes de que se agote.

## Stock actual

La tabla **Stock actual**, ubicada arriba de la lista de stock bajo,
muestra el stock disponible de **todos** los artículos en los almacenes
configurados — no solo los que están en riesgo. Usa el campo de
búsqueda para filtrar por código o nombre de artículo. A diferencia de
la lista de stock bajo, esta tabla no depende del historial de ventas:
un artículo aparece aquí aunque no haya tenido ventas recientes.

## Glosario de campos

- **Almacén**: el almacén de Profit Plus donde se encuentra ese stock.
- **Stock**: la cantidad actual disponible según Profit Plus.
- **Venta diaria prom.**: el promedio de unidades vendidas por día,
  calculado sobre la ventana de días configurada por el administrador
  (ver más abajo).
- **Días de stock**: una estimación de cuántos días más durará el stock
  actual, al ritmo de venta promedio. Se calcula como `stock ÷ venta
  diaria promedio`.

## ¿Cómo se decide qué artículos aparecen aquí?

Un artículo aparece en esta lista solo si:

1. Tuvo ventas registradas en la ventana de días configurada (por
   defecto, los últimos 60 días). Artículos sin ventas recientes no
   tienen suficiente información para estimar cuánto durará el stock,
   así que no se muestran — eso no significa que estén bien
   abastecidos, solo que no se puede calcular.
2. El resultado de días de stock es menor al umbral configurado (por
   defecto, 7 días).

Un administrador puede ajustar ambos números (la ventana de días y el
umbral de alerta) desde **Admin → Config. Inventario**.

## Sobre el "stock negativo"

Si ves una fila marcada como **(stock negativo)**, significa que Profit
Plus tiene un valor de stock por debajo de cero para ese artículo en
ese almacén — normalmente porque se han registrado ventas desde ese
almacén sin haber registrado antes las entradas de mercancía
correspondientes. En ese caso, el número de "días de stock" no refleja
una situación real y no debe usarse para decidir reabastecimiento hasta
que el stock de ese almacén esté correctamente registrado.
