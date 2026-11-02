# Runbook de producción: precios por tipo de cliente (BORRADOR)

> **Estado: borrador, nada de esto está construido ni aprobado.**
> Los comandos marcados **(nuevo)** no existen todavía; se construyen después de aprobar el diseño.
> Los demás ya existen (ver `data/pricing-lists/README.md`).
> Supuestos sin confirmar están en «Pendientes» al final.

## Objetivo

Bajar los precios base por tipo de cliente (Cadenas, Independientes, Mayoristas, Restaurantes) y cargar a la vez las promociones temporales y los descuentos por cliente y artículo.
Alcance de artículos: solo productos terminados, líneas **Panadería, Pastelería y Pizza** (68 artículos hoy).

## Reglas de seguridad

- Todo comando escribe solo con `--apply --confirm-db <DB_NAME>`. Sin eso es simulación.
- Ejecutar siempre desde la raíz del repo (los scripts leen `.env.local` del directorio actual).
- Profit **no permite borrar listas ni tarifas** desde la app. La reversa de precios es volver a cargar el archivo «antes» (paso 2).
- Una lista nueva no afecta a ningún cliente hasta que se le asigna (`tip_cli`). Cargar precios es seguro; **mover clientes (paso 8) es lo que cambia lo que se factura**.

## Antes de empezar

1. **Respaldo** de la base ERP (backup SQL Server) y anotar el `DB_NAME` destino.
2. **Ensayo general** en una instancia de Profit que no sea producción, con todo el flujo. Solo después producción.
3. Confirmar que las migraciones están aplicadas (procs `pApi*` de `migrations/mssql/0010-0014`, SQLite al día). Ver `INSTRUCTIONS.md`.
4. Refrescar el DWH (`bun run dwh:incremental-load`): el filtro de línea sale de `Dim_Product.LineName`.
5. Elegir la fecha de vigencia `desde`: **hoy o futura** (nunca pasada). Una fecha futura deja los precios programados y no cambia nada hoy.

## Paso 1. Exportar el estado actual (nuevo)

```bash
bun run pricing:export-xlsx            # escribe data/pricing-lists/precios-actuales.xlsx
```

Guarda una copia fuera del repo con fecha (`precios-ANTES-AAAA-MM-DD.xlsx`). **Es la reversa.**

El libro trae: `Listas`, `Precios` (68 artículos, precio actual por lista), `Promociones` (activas y programadas), `Descuentos por cliente`, `Clientes` (segmento y lista actuales).

## Paso 2. Llenar el libro

1. `Listas`: agregar Cadenas, Independientes, Mayoristas, Restaurantes (nombre, moneda `USD`/`BSD`, `desde`).
2. `Precios`: precio final por artículo en cada columna de tipo. Celda vacía = sin precio en esa lista. Punto decimal, sin símbolos.
3. `Promociones`: editar o agregar filas (una por artículo). `desde`/`hasta` iguales en toda la promoción.
4. `Descuentos por cliente`: `co_cli`, `co_art`, precio final **o** `-8%`, `desde`, `hasta` (vacío = permanente).
5. `Clientes`: columna `tipo nuevo` con el tipo de cada cliente.

## Paso 3. Simulación (nuevo)

```bash
bun run pricing:import-xlsx -- --file <ruta.xlsx>
```

No escribe nada. Revisar la salida:

- [ ] Cada precio como `anterior → nuevo`, sin sorpresas (precios en 0, subidas inesperadas).
- [ ] Ningún artículo fuera de Panadería/Pastelería/Pizza (se rechaza).
- [ ] Sin conflicto con promociones activas (el importador rechaza cambiar el precio regular de un artículo en promoción activa o programada de esa lista).
- [ ] Listas especiales por cliente: cuántas se crean y cuántos artículos difieren de la base.
- [ ] Promociones: avisos de «precio promocional no menor que el regular».
- [ ] Clientes: avisos de moneda distinta a la de la lista, listas sin precios.

Si hay errores sale con código 1 sin escribir. Corregir el libro y repetir.

## Paso 4. Aplicar listas y precios regulares

```bash
bun run pricing:import-lists -- --apply --confirm-db <DB_NAME>
```

(o el subcomando equivalente de `pricing:import-xlsx`). Reutiliza por nombre las listas ya creadas y omite precios iguales, así que se puede repetir si algo falla.

## Paso 5. Aplicar promociones

```bash
bun run pricing:import-promotions -- --apply --confirm-db <DB_NAME>
```

Debe ir **después** del paso 4: una promoción necesita un precio regular vigente en esa lista.

## Paso 6. Aplicar listas especiales por cliente (nuevo)

Crea un segmento y lista por cada conjunto distinto de descuentos, y la lista es copia de la lista del tipo con los artículos con descuento reemplazados. Los que tienen `hasta` quedan registrados para el barrido nocturno.

## Paso 7. Verificar antes de mover clientes

- [ ] Pestaña **Listas** de `/pricing`: las 4 listas existen con la moneda y los precios esperados.
- [ ] Pestaña **Promociones**: fechas y artículos correctos.
- [ ] Pestaña **Vencimientos**: nada raro; el barrido nocturno (`pricing:sweep-promotions`) sigue programado en el Task Scheduler.
- [ ] Revisar `pricing_audit_log` (`list_create`, `rates_apply`).

## Paso 8. Asignar clientes (esto cambia lo que se factura)

```bash
bun run tipo-cliente:apply                                          # simulación
bun run tipo-cliente:apply -- --apply --confirm-db <DB_NAME>
```

Hacerlo en horario sin facturación o con la fecha `desde` futura. Anotar el `runId` que imprime.

## Paso 9. Verificación final

1. Facturar o cotizar un artículo de prueba a un cliente de cada tipo y a uno con descuento especial; comparar con el libro.
2. Comprobar la moneda: factura en BSD contra lista en USD (no verificado antes, ver pendientes).

## Reversa

| Qué | Cómo |
|---|---|
| Clientes mal asignados | `bun run tipo-cliente:apply -- --rollback <runId> --confirm-db <DB_NAME>` |
| Precio incorrecto | Corregir el libro y volver a cargar con `desde` de hoy o posterior (el precio anterior queda cerrado, no se borra) |
| Volver a los precios de antes | Cargar `precios-ANTES-…xlsx` con `desde` de hoy o posterior |
| Promoción incorrecta | Cancelar o cambiar el fin en la pestaña **Promociones** |
| Listas y segmentos creados | No se borran; sin clientes asignados no tienen efecto |

## Pendientes por confirmar

- Si el alcance son exactamente las 68 piezas de Panadería/Pastelería/Pizza, o solo las vendidas en los últimos N meses.
- Almacén de los precios (hoy `000015`), unidad de medida y conversión de moneda USD/BSD en la factura (ver `data/pricing-lists/README.md`, «Antes de cargar»).
- Cómo se resincronizan las listas especiales cuando cambia un precio base.
- Cuántos clientes tienen descuentos por artículo y si son permanentes o con fecha.
