# Tabla: saMoneda
**Módulo**: Configuración (Multimoneda)
**Descripción de Negocio**: Catálogo de monedas. Define las divisas disponibles en el sistema. La columna `cambio` es la tasa base almacenada en el maestro (no historial); para conversiones históricas siempre usar `saTasa`. El campo `relacion` indica si la moneda es relativa a otra (ej: USD como moneda de referencia).

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_mone` | char | NOT NULL | Código ISO de la moneda (PK): `VES`, `USD`, `EUR` | Clave Primaria |
| `mone_des` | varchar | NULL | Nombre de la moneda (ej: Bolívar Digital, Dólar) | — |
| `cambio` | decimal | NULL | Tasa de cambio base actual (referencia, no histórico) | — |
| `relacion` | bit | NULL | `1` = moneda relativa a la moneda base del sistema | — |
