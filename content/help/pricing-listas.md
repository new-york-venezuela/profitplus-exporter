## ¿Qué es esta pestaña?

Aquí consultas y editas las **listas de precio** de Profit Plus: el precio
de cada artículo en cada lista, con su fecha de inicio de vigencia. Cada
segmento de clientes usa **una** lista, así que cambiar un precio aquí
cambia lo que pagan todos los clientes de los segmentos que la usan.

## Listas de precio y tarifas

A la izquierda ves las listas (con su moneda y cuántas tarifas tienen); al
elegir una, a la derecha aparece la tabla de artículos con su precio
**Vigente** y las columnas **Nuevo** y **Nuevo Δ%** para editar.

- **Nuevo** y **Nuevo Δ%** están enlazados: si escribes el precio, el
  porcentaje se calcula contra el precio de referencia; si escribes el
  porcentaje, se calcula el precio.
- El precio se redondea a **2 decimales**, así que un porcentaje puede
  verse ligeramente distinto al que escribiste: **5 %** puede mostrarse
  como **5,02 %** si el precio redondeado corresponde a ese porcentaje.
- Marca varios artículos para usar las acciones masivas: **+ %**, **− %**
  o **Fijar precio**. Los artículos sin precio de referencia se omiten y
  se te avisa cuántos fueron.
- **Descartar** borra todos los cambios que aún no has aplicado.

## Cómo se aplica un cambio de precio

1. Edita los precios que quieras y elige la fecha en **Vigente desde**.
2. Pulsa **Aplicar**: verás cada artículo con su precio antes y después.
3. Confirma. El resultado aparece por artículo: **Éxito**, **Omitido**,
   **Conflicto** o **Rechazado**. Los conflictos se pueden volver a
   intentar con **Reintentar**.

Un cambio **cierra** la tarifa vigente el día anterior e **inserta** una
tarifa nueva desde la fecha elegida: el **historial se conserva**. Si
**Vigente desde** es una fecha futura, el cambio queda **programado**
(aparece la etiqueta **Programado**) y el precio actual no se toca hasta
ese día. No se permiten fechas pasadas.

## Comparar con

**Comparar con** cambia el precio de referencia contra el que se calculan
los porcentajes. Sin selección se usa la **tarifa anterior** de la misma
lista; si eliges otra lista, los porcentajes se calculan contra el precio
vigente de esa lista.

## Nueva lista y clonar

- **Nueva lista** crea una lista vacía con el nombre y la moneda (BSD o
  USD, entre otras) que elijas. La moneda no se puede cambiar después.
- **Clonar** copia las tarifas vigentes de la lista actual a una lista
  nueva, con un ajuste opcional en % y una fecha de inicio (hoy o futura).

## Etiqueta «varios almacenes»

Si un artículo tiene tarifas en más de un almacén dentro de la misma
lista, aparece la etiqueta **varios almacenes** y su fila es de solo
lectura: edítalo directamente en Profit Plus.

## Consulta de artículo

La vista **Artículos** muestra, para el artículo que busques, su precio en
**todas** las listas: **Vigente**, **Próximo** (programado) y un
**historial** desplegable. Si eliges un cliente, también ves su **precio
efectivo** según la lista de su segmento.

## Exportar

**Exportar** descarga un CSV con las tarifas de la lista seleccionada.

## Permisos

- Con permiso de **consulta** ves listas, tarifas y la consulta de
  artículos, sin botones de edición.
- Con permiso de **edición** además puedes editar precios, aplicar
  cambios, crear y clonar listas.

## Solución de problemas

- **Conflicto**: otra persona modificó esa tarifa mientras editabas. Usa
  **Reintentar** o recarga la lista.
- **Hay cambios sin aplicar** al cambiar de lista: elige **Descartar**
  para perderlos o **Seguir editando** para volver.
