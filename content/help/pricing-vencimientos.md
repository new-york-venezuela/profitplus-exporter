## ¿Qué es esta pestaña?

**Vencimientos** muestra, en vivo, lo que está por terminar o lo que no
terminó bien en tus precios: promociones que se acaban, segmentos
vencidos con clientes dentro, artículos que se quedaron sin precio y el
estado de la tarea nocturna. Arriba eliges entre **Listas** y **Línea de
tiempo**. En **Listas** puedes cambiar la ventana de **Terminan en los
próximos** 7, 14 o 30 días.

## Las secciones y qué hacer

- **Terminan pronto**: promociones activas cuyo último día cae dentro de
  la ventana. Abre la promoción con **Ver promoción**; si quieres que
  siga, usa **Cambiar fecha de fin** antes de que termine. Las
  promociones sobre una lista vuelven solas al precio regular.
- **Vencidas sin revertir**: segmentos especiales (o de promoción) cuya
  fecha de vencimiento ya pasó y todavía tienen clientes. Los clientes
  vuelven a su segmento anterior con la tarea nocturna; mueve a los
  clientes a mano desde **Ver segmento** o ejecuta el barrido. Aquí
  también aparecen las **promociones terminadas con precios aún
  vigentes**: el precio promocional siguió corriendo después del fin
  porque falló el acortamiento. Abre la promoción y usa **Reintentar**
  (si se estaba cancelando, vuelve a cancelar). Desaparece de la lista
  cuando ya no queda ningún precio vigente.
- **Sin precio vigente**: artículos de listas **con clientes asignados**
  que hoy no tienen ninguna fila de precio vigente (la última venció y no
  hay otra). Se resuelve en **Listas**: agrega o extiende una tarifa para
  ese artículo. Si hay una fecha de regreso (**vuelve el…**) el hueco es
  temporal.
- **Estado del barrido**: indica si la tarea nocturna está viva (ver
  abajo).

## La tarea nocturna y el barrido

El comando `bun run pricing:sweep-promotions` regresa a sus clientes de
los segmentos vencidos. Cada vez que corre deja un **latido** (la hora,
cuántos clientes movió y si algo falló), incluso si se rompe a la mitad.
Con ese latido la pestaña distingue cuatro casos:

- **Al día**: corrió hace menos de 36 horas sin errores.
- **Sin ejecutar**: nunca ha corrido. Revisa que la tarea esté creada.
- **Atrasado**: el último latido tiene más de 36 horas.
- **Falló**: el último barrido terminó con error o con clientes sin mover;
  se muestra el motivo. Se corrige la causa y se vuelve a ejecutar.

El barrido depende del **Programador de tareas de Windows** del servidor:
si está atrasado o sin ejecutar, revisa que la tarea esté habilitada y
su último resultado (`INSTRUCTIONS.md`, **Step 10**). Esta pestaña no puede
ejecutarlo por ti.

## El correo de resumen

Al terminar, el barrido envía un resumen por correo, **solo si hay algo
que reportar**:

- Aviso de **Terminan pronto**: una vez cuando faltan los días
  configurados (o menos) y otra el último día. Si un día no corrió el
  barrido, el aviso igual sale en la siguiente ejecución y nunca se
  repite.
- Fallos del barrido, promociones terminadas con precios vigentes,
  segmentos vencidos sin revertir y artículos sin precio **se repiten
  cada día** hasta que se resuelvan.
- Si el correo no se pudo enviar a nadie, los avisos de "Terminan pronto"
  no se marcan como enviados y se reintentan en la siguiente ejecución.

Los destinatarios son los que se indiquen en **Alertas por correo**; si
está vacío, reciben el resumen los administradores y los editores de
precios que tengan correo. Solo un **administrador** ve el botón
**Alertas por correo**, donde puede activar o apagar el envío, cambiar
los días de anticipación (1 a 60) y la lista de destinatarios.

## Línea de tiempo

Muestra las promociones del mes (activas, programadas, terminadas y
canceladas) como barras; el estado va escrito en cada barra, no solo en
el color. Navega con **Mes anterior** y **Mes siguiente**, y haz clic en
una barra para abrir la promoción. Debajo hay la misma información como
lista.
