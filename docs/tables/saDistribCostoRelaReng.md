# Tabla: saDistribCostoRelaReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `distrib_num_destino` | char(20) | NOT NULL | b'Codigo del costo distribuido destino' | FK → `saDistribCostoDestinoReng.distrib_num` |
| `reng_num_destino` | int(10,0) | NOT NULL | b'Renglon del costo distribuido destino' | FK → `saDistribCostoDestinoReng.reng_num` |
| `distrib_num_origen` | char(20) | NOT NULL | b'Codigo del costo distribuido origen' | FK → `saDistribCostoOrigenReng.distrib_num` |
| `reng_num_origen` | int(10,0) | NOT NULL | b'Renglon del costo distribuido origen' | FK → `saDistribCostoOrigenReng.reng_num` |
| `tipo_distrib` | char(1) | NOT NULL | — | — |
| `monto` | decimal(18,5) | NOT NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saDistribCostoRelaReng_saDistribCostoOrigenReng`: `distrib_num_origen` → `saDistribCostoOrigenReng.distrib_num`
- `FK_saDistribCostoRelaReng_saDistribCostoOrigenReng`: `reng_num_origen` → `saDistribCostoOrigenReng.reng_num`
- `FK_saDistribCostoRelaReng_saDistribCostoDestinoReng`: `distrib_num_destino` → `saDistribCostoDestinoReng.distrib_num`
- `FK_saDistribCostoRelaReng_saDistribCostoDestinoReng`: `reng_num_destino` → `saDistribCostoDestinoReng.reng_num`
