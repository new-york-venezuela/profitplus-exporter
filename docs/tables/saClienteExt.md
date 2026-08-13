# Tabla: saClienteExt
**Módulo**: Clientes
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_cli` | uniqueidentifier | NOT NULL | — | — |
| `n_cr` | char(2) | NULL | — | FK → `saTipoComprobante.co_tipo` |
| `n_db` | char(2) | NULL | — | FK → `saTipoComprobante.co_tipo` |
| `tComp` | char(2) | NULL | — | FK → `saTipoComprobante.co_tipo` |
| `campo1` | varchar(60) | NULL | — | — |
| `campo2` | varchar(60) | NULL | — | — |
| `campo3` | varchar(60) | NULL | — | — |
| `campo4` | varchar(60) | NULL | — | — |
| `campo5` | varchar(60) | NULL | — | — |
| `campo6` | varchar(60) | NULL | — | — |
| `campo7` | varchar(60) | NULL | — | — |
| `campo8` | varchar(60) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `transfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NOT NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saClienteExt_saTipoComprobante`: `tComp` → `saTipoComprobante.co_tipo`
- `FK_saClienteExt_saTipoComprobante1`: `n_cr` → `saTipoComprobante.co_tipo`
- `FK_saClienteExt_saTipoComprobante2`: `n_db` → `saTipoComprobante.co_tipo`
