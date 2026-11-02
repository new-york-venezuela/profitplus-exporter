# Runbook de producción: precios por tipo de cliente

> Guía de uso del libro de Excel: `README.md` («Cargar desde Excel»). Diseño: `docs/superpowers/specs/2026-11-02-customer-type-pricing-design.md`.
> Supuestos sin confirmar están en «Pendientes» al final.

## Objetivo

Bajar los precios base por tipo de cliente (Cadenas, Independientes, Mayoristas, Restaurantes) y cargar a la vez las promociones temporales y los descuentos por cliente y artículo.
Alcance de artículos: solo productos terminados, líneas **Panadería, Pastelería y Pizza** (68 artículos hoy).

## Reglas de seguridad

- Todo comando escribe solo con `--apply --confirm-db <DB_NAME>`. Sin eso es simulación.
- Ejecutar siempre desde la raíz del repo (los scripts leen `.env.local` del directorio actual).
- Profit **no permite borrar listas, tarifas, promociones ni descuentos** desde la app. El archivo «antes» (paso 1) es un registro para **leer** qué precios había, no un mecanismo de restauración: ver «Reversa».
- Una lista nueva no afecta a ningún cliente hasta que se le asigna (`tip_cli`). Cargar precios es seguro; **mover clientes (paso 7) es lo que cambia lo que se factura**.
- Si el plan tiene algún problema, el comando no escribe nada.

## Antes de empezar

1. **Respaldo** de la base ERP (backup SQL Server) y anotar el `DB_NAME` destino.
2. **Ensayo general** en una instancia de Profit que no sea producción, con todo el flujo. Solo después producción.
3. Confirmar que las migraciones están aplicadas (procs `pApi*` de `migrations/mssql/0010-0014`, SQLite al día). Ver `INSTRUCTIONS.md`.
4. Refrescar el DWH (`bun run dwh:incremental-load`): el filtro de línea sale de `Dim_Product.LineName`.
5. Elegir la fecha de vigencia `desde` de las listas y promociones: **hoy o futura** (nunca pasada). Una fecha futura deja los precios programados y no cambia nada hoy. Los **descuentos por cliente** son la excepción: su `desde` debe ser **hoy** (la fecha en que se ejecuta el comando).

## Paso 1. Exportar el estado actual

```bash
bun run pricing:export-xlsx            # escribe data/pricing-lists/precios-actuales.xlsx (no sobrescribe; --out <ruta> para otra)
```

Guarda una copia fuera del repo con fecha (`precios-ANTES-AAAA-MM-DD.xlsx`). **Es un registro para consultar** qué precios había; volver a cargarlo no los restaura (el importador solo lee columnas de precio de listas marcadas `nueva` = `SI`).

El libro trae: `Listas`, `Precios` (68 artículos, precio actual por lista), `Promociones` (activas y programadas, con `estado`), `Descuentos por cliente`, `Clientes` (segmento y lista actuales).

## Paso 2. Llenar el libro

1. `Listas`: agregar filas para Cadenas, Independientes, Mayoristas, Restaurantes (clave en `lista`, nombre, moneda `USD`/`BSD`, `desde`) con `nueva` = `SI`. Solo se crean las filas `SI`; las demás son contexto. **Una lista nueva que sea el tipo de un cliente con descuento debe empezar hoy** (`desde` = hoy); si empieza después, el plan lo reporta como problema.
2. `Precios`: precio final por artículo en la columna de cada lista nueva (el encabezado es la clave de `lista`). Celda vacía = sin precio en esa lista. Punto decimal, sin símbolos. Las columnas `actual <lista>` son solo lectura.
3. `Promociones`: agregar filas **nuevas** con `estado` vacío (una por artículo; `desde`/`hasta` iguales en toda la promoción). Las filas con `estado` lleno son promociones que ya existen y se ignoran: para editarlas o cancelarlas use la pestaña **Promociones** de la app.
4. `Descuentos por cliente`: `co_cli`, `co_art`, precio final **o** `-8%` (sobre el precio regular de la lista del tipo, nunca sobre una promoción vigente), `desde` (**hoy**), `hasta` (vacío = permanente; si no, posterior a hoy). Recuerde: una lista nueva que sea el tipo de un cliente con descuento debe empezar hoy.
5. `Clientes`: columna `tip_cli_nuevo` con el tipo de cada cliente (segmento, código de lista, `L:código`, o la clave/nombre de una lista nueva de `Listas`).

## Paso 3. Simulación

```bash
bun run pricing:import-xlsx -- --file <ruta.xlsx>
```

No escribe nada (también se puede revisar un paso: `--step lists|promotions|customers|discounts`). Revisar la salida:

- [ ] Cada precio como `anterior → nuevo`, sin sorpresas (precios en 0, subidas inesperadas).
- [ ] Ningún artículo fuera de Panadería/Pastelería/Pizza (se rechaza).
- [ ] Sin conflicto con promociones activas (el importador rechaza cambiar el precio regular de un artículo en promoción activa o programada de esa lista).
- [ ] Promociones: avisos de «precio promocional no menor que el regular».
- [ ] Clientes: avisos de moneda distinta a la de la lista, listas sin precios.
- [ ] Descuentos: listas especiales a crear, cuántos clientes en cada una y aviso de listas especiales desactualizadas.
- [ ] Ningún cliente con descuento está hoy en un segmento de promoción ni en otro segmento de descuento (se reporta como error y no se mueve; muévalo antes a su segmento del tipo).

Si hay errores sale con código 1 sin escribir. Corregir el libro y repetir.

## Paso 4. Aplicar listas y precios regulares

```bash
bun run pricing:import-xlsx -- --file <ruta.xlsx> --step lists --apply --confirm-db <DB_NAME>
```

Reutiliza por nombre las listas ya creadas y omite precios iguales, así que se puede repetir si algo falla.

## Paso 5. Aplicar promociones

```bash
bun run pricing:import-xlsx -- --file <ruta.xlsx> --step promotions --apply --confirm-db <DB_NAME>
```

Debe ir **después** del paso 4: una promoción necesita un precio regular vigente en esa lista.

## Paso 6. Verificar antes de mover clientes

- [ ] Pestaña **Listas** de `/pricing`: las 4 listas existen con la moneda y los precios esperados.
- [ ] Pestaña **Promociones**: fechas y artículos correctos.
- [ ] Pestaña **Vencimientos**: nada raro; el barrido nocturno (`pricing:sweep-promotions`) sigue programado en el Task Scheduler.
- [ ] Revisar `pricing_audit_log` (`list_create`, `rates_apply`).

## Paso 7. Asignar clientes (esto cambia lo que se factura)

```bash
bun run pricing:import-xlsx -- --file <ruta.xlsx> --step customers --apply --confirm-db <DB_NAME>
```

Hacerlo en horario sin facturación o con la fecha `desde` futura. Anota el `runId` que imprime (para revertir este paso, hágalo antes del paso 8) (la corrida queda en `data/tipo-cliente/runs/<runId>.jsonl`). Con este paso solo, las listas nuevas se buscan por `nombre` en Profit: si hay dos con el mismo nombre falla.

## Paso 8. Aplicar descuentos por cliente

```bash
bun run pricing:import-xlsx -- --file <ruta.xlsx> --step discounts --apply --confirm-db <DB_NAME>
```

Va **después** del paso 7: el segmento de descuento con fecha vuelve al segmento del tipo cuando vence, así que el cliente ya debe tener su tipo. Crea una lista especial por cada conjunto distinto de descuentos (copia de la lista del tipo con los artículos con descuento reemplazados; los clientes con los mismos descuentos la comparten). Los permanentes comparten un segmento de grupo por lista especial; los que tienen `hasta` reciben un segmento propio con vencimiento y el barrido nocturno los revierte. Los descuentos empiezan **hoy**.

> **Atención con `--step all`** (o sin `--step`): ejecuta los pasos 4, 5, 7 y 8 seguidos, en ese orden, y se detiene en el primero que falle. **Elimina las verificaciones de los pasos 6 y 7** (no hay pausa entre asignar clientes y aplicar descuentos).
> - La **primera corrida en producción se hace paso a paso**: listas, promociones, verificar, clientes, verificar, descuentos.
> - `--step all` solo para repetir un libro ya ensayado.
> - Si usó `--step all`, la reversa del paso de clientes **no devuelve a los clientes con descuento** (ya pasaron a su segmento de descuento): hay que moverlos a mano en la pestaña **Segmentos**.

### Volver a cargar los descuentos

- **Mismo libro, otro día** (mismos descuentos, `desde` = el nuevo hoy): la lista especial y su segmento se **reutilizan por nombre** y los clientes que ya están en su segmento se omiten; no se crea nada nuevo. Si cambió un `hasta`, se actualiza el vencimiento del segmento especial.
- La lista especial es una **copia de los precios del tipo del primer día**: no se actualiza al reutilizarla. La simulación avisa cuando quedó desactualizada respecto a la lista del tipo.
- **Si cambiaron los descuentos** de un cliente (otro precio u otro artículo), se crea una lista especial **nueva** (otra clave en el nombre). El importador no saca a un cliente de otro segmento de descuento: muévalo **antes** a su segmento del tipo en la pestaña **Segmentos** y vuelva a aplicar.
- Las listas y segmentos especiales que quedan sin uso cuando cambian los descuentos **no se borran** (Profit no lo permite); sin clientes no tienen efecto.

## Paso 9. Verificación final

1. Facturar o cotizar un artículo de prueba a un cliente de cada tipo y a uno con descuento especial; comparar con el libro.
2. Comprobar la moneda: factura en BSD contra lista en USD (no verificado antes, ver pendientes).

## Reversa

| Qué | Cómo |
|---|---|
| Clientes mal asignados (paso 7) | `bun run tipo-cliente:apply -- --rollback <runId> --confirm-db <DB_NAME>` (único paso con reversa automática). **Hágalo ANTES de aplicar los descuentos (paso 8)**: la reversa omite a los clientes movidos desde entonces, así que los que ya pasaron a un segmento de descuento se omiten y hay que devolverlos a mano en la pestaña **Segmentos** |
| Precio incorrecto | Corregirlo a mano en la pestaña **Listas** de la app (con `desde` de hoy; el precio anterior queda cerrado, no se borra), o volver a ejecutar la importación con la lista `nueva` corregida (solo vale para listas creadas desde ese mismo libro: se reutilizan por nombre y los precios iguales se omiten) |
| Volver a los precios de antes | No se restauran desde `precios-ANTES-…xlsx`: léalo para saber qué precio había y corrija cada uno a mano en la pestaña **Listas** (`desde` de hoy) |
| Promoción incorrecta | Cancelar o cambiar el fin en la pestaña **Promociones** |
| Descuento incorrecto | No hay reversa automática: mover el cliente a su segmento del tipo en la pestaña **Segmentos** y volver a cargar el libro corregido |
| Listas y segmentos creados | No se borran; sin clientes asignados no tienen efecto |

## Pendientes por confirmar

- Si el alcance son exactamente las 68 piezas de Panadería/Pastelería/Pizza, o solo las vendidas en los últimos N meses.
- Almacén de los precios (hoy `000015`), unidad de medida y conversión de moneda USD/BSD en la factura (ver `README.md`, «Antes de cargar»); sin verificar en Profit.
- Cómo se resincronizan las listas especiales cuando cambia un precio base: hoy solo hay aviso en la simulación, no existe herramienta de resincronización.
- Cuántos clientes tienen descuentos por artículo y si son permanentes o con fecha.
