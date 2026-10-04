# Recetas

Define qué insumos componen cada producto terminado y en qué cantidad.
El costo de fabricación se calcula en vivo con el método PEPS (FIFO) sobre
las capas de costo reales de Profit Plus, convertido a dólares con la tasa
más reciente disponible.

Los renglones pueden referenciar un artículo de Profit Plus (su costo se
recalcula automáticamente) o ser manuales, para insumos que no se compran
por Profit Plus (por ejemplo, agua del servicio) — en ese caso tú indicas
el costo por unidad.

## Qué significan los avisos del panel de costo

- **"Sin datos"** en un renglón: ese insumo nunca ha tenido una compra
  registrada en Profit Plus, así que no hay ningún costo real con qué
  calcularlo. No se muestra como $0 a propósito — un $0 se vería como un
  costo real y haría que el total pareciera más bajo de lo que es.
- **"Estimado"** en un renglón: la cantidad que necesita la receta es
  mayor a lo que queda registrado en Profit Plus para ese insumo, así que
  el faltante se calculó con el precio de la compra más reciente en vez
  del método PEPS estricto. Es la mejor aproximación disponible, pero no
  es el número exacto.
- **Aviso amarillo sobre el total**: aparece si cualquier renglón tiene
  "Sin datos" o "Estimado" — es una señal de que el total mostrado podría
  no reflejar el costo real completo, no un error del sistema.

Si ves estos avisos seguido para un insumo en particular, probablemente
signifique que ese artículo necesita que se registren sus compras o
consumos en Profit Plus con más regularidad.
