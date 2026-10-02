## ¿Qué es esta página?

Aquí administras los **segmentos** de clientes y la **lista de precios**
que usa cada uno. Un segmento es un *tipo de cliente* de Profit Plus que
apunta a **una sola lista de precios**: todos los clientes del segmento
compran con esa lista.

## Segmentos y listas de precio

A la izquierda ves la lista de segmentos; al elegir uno, a la derecha
aparecen sus clientes y la lista de precios que tiene asignada.

- **Mover un cliente a otro segmento** cambia también su lista de
  precios: el cliente pasa a usar la lista del segmento de destino. Usa
  el botón **Mover a segmento…** en el panel del cliente.
- **Cambiar lista** (sobre un segmento) asigna una lista nueva y
  recalcula el precio de **todos** los clientes del segmento en una sola
  operación.

Segmento y lista de precios **no** son el campo `co_seg` de Profit Plus:
ese campo no se modifica desde esta página.

## Precio especial

Un **precio especial** crea un segmento de **un solo cliente** con una
lista de precios propia y una fecha de fin. El nombre se genera
automáticamente con el formato `Cliente · motivo · hasta dd/mm`, para
que sea fácil de reconocer en la lista.

Cada segmento especial muestra su vigencia: **⏳ N d** indica los días
que le quedan y **vencida** indica que ya pasó la fecha de fin.

## Importante: el vencimiento aún no es automático

En esta versión el vencimiento **solo se muestra**. Un segmento especial
marcado como **vencida** no vuelve automáticamente al segmento anterior del cliente:
debes moverlo tú manualmente con **Mover a segmento…**. Una versión
posterior agregará el regreso automático cada noche.

## Permisos

- Con permiso de **consulta** puedes ver segmentos, listas y clientes.
- Con permiso de **edición** además ves los botones para mover clientes,
  crear precios especiales y cambiar listas.

## Solución de problemas

- **Mensaje de conflicto**: significa que otra persona modificó el mismo
  registro mientras lo editabas. Recarga la página y vuelve a intentarlo.
- **No ves los botones de edición**: tu usuario solo tiene permiso de
  consulta; pide acceso de edición a un administrador.
- **Un precio especial sigue activo después de su fecha**: es el
  comportamiento esperado en esta versión (ver arriba); muévelo a mano.
