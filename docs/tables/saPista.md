# Tabla: saPista
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `fecha` | datetime(23,3) | NOT NULL | b'Fecha y Hora' | — |
| `tablaOri` | varchar(32) | NOT NULL | b'Tablas' | — |
| `rowguidOri` | uniqueidentifier | NULL | — | — |
| `usuario_id` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario ' | — |
| `co_sucu` | char(6) | NULL | b'C\xc3\xb3digo Sucursal' | — |
| `tipo_op` | char(1) | NOT NULL | b'Tipo de operaci\xc3\xb3n' | — |
| `maquina` | varchar(60) | NULL | b'Maquina del usuario' | — |
| `campos` | varchar(max) | NULL | b'Campos' | — |
| `aux01` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `aux02` | varchar(30) | NULL | b'Reservado para futuras implementaciones' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
- `TrigDelete_saPista`
- `TrigUpdate_saPista`
