## ¿Qué es esta pestaña?

En **Promociones** programas precios especiales por un periodo de fechas:
eliges los artículos, el precio promocional y los días que dura. Las
promociones se agrupan por estado: **Programada**, **Activa**,
**Terminada** y **Cancelada**.

## Promociones de precio: los dos tipos

- **Sobre una lista**: el precio promocional rige en una lista de precios
  existente durante las fechas elegidas. Lo ven **todos** los clientes
  cuyo segmento usa esa lista. Úsala cuando la oferta es para todos.
- **Para un segmento o clientes**: eliges una **lista base** y uno o más
  clientes (hasta 500). Se crea una lista y un segmento temporales y los
  clientes pasan a ese segmento; el resto de clientes no cambia. Úsala
  cuando la oferta es solo para algunos clientes.

## Crear una promoción

El asistente tiene cuatro pasos:

1. **Qué**: nombre (hasta 40 caracteres), motivo opcional, el tipo y la
   lista (o la lista base y los clientes).
2. **Artículos y precio**: solo aparecen artículos con precio vigente.
   Escribe el precio o el **Δ%** contra el precio regular, o marca varios
   artículos y usa **+ %**, **− %** o **Fijar precio**. Las filas sin
   precio de referencia se omiten y se te avisa cuántas.
3. **Fechas**: inicio (hoy o futuro) y fin. El día de fin es **inclusive**
   hasta las 23:59. Verás cuántos días faltan para que termine.
4. **Revisión**: se comprueba cada artículo. Los **rechazados** muestran
   el motivo; para aplicar debes marcar **Continuar sin los artículos
   rechazados**, que los deja fuera de la promoción.

## Qué pasa al terminar

- **Sobre una lista**: Profit busca el precio por fecha, así que el día
  siguiente al fin vuelve **solo** a la fila de precio regular. No hace
  falta ninguna tarea.
- **Para un segmento o clientes**: los clientes vuelven a su segmento
  anterior mediante la tarea nocturna `bun run pricing:sweep-promotions`.
  Esa tarea **debe estar programada** en el servidor: está explicada en
  `INSTRUCTIONS.md`, **Step 10**. Si no se ejecuta, los clientes se
  quedan en el segmento de la promoción.

## Cancelar y cambiar la fecha de fin

**Cancelar** y **Cambiar fecha de fin** nunca dejan un día sin precio: el
precio regular continúa desde el día siguiente. Una promoción que aún no
empezó se cancela sin tocar los precios actuales. Cancelar no se puede
deshacer; para repetir la oferta crea una nueva.

## Aplicaciones parciales y Reintentar

Si algún artículo no se pudo aplicar (por ejemplo, un conflicto con otro
cambio), la promoción queda marcada como **parcial** y cada artículo
muestra su mensaje. Pulsa **Reintentar** para completar lo pendiente. Si
reintentas después de que la promoción ya empezó, lo pendiente se aplica
**desde hoy**, no desde la fecha original.

## Duplicar

**Duplicar** abre el asistente con el nombre (más «(copia)»), el tipo, la
lista, los clientes y los precios de una promoción existente. Las fechas
quedan vacías: elígelas de nuevo.

## Permisos

- Con permiso de **consulta** ves las promociones y su detalle.
- Con permiso de **edición** además puedes crear, cancelar, cambiar la
  fecha de fin, reintentar y duplicar.

## Solución de problemas

- **Un cliente sigue en la lista de la promoción después de la fecha de
  fin**: revisa que la tarea `bun run pricing:sweep-promotions` esté
  programada (`INSTRUCTIONS.md`, Step 10) y que se ejecutó después de la
  medianoche del último día. El registro de auditoría muestra cuándo se
  movió cada cliente de vuelta.
- **Artículo rechazado**: lee el motivo en la revisión; suele ser un
  artículo sin precio vigente, con tarifas en varios almacenes o de otra
  moneda que la lista.
