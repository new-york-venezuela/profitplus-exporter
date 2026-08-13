# Tabla: saCobroTPReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `reng_num` | int(10,0) | NOT NULL | — | — |
| `cob_num` | char(20) | NOT NULL | — | FK → `saCobro.cob_num` |
| `co_tar` | char(6) | NULL | — | FK → `saTarjetaCredito.co_tar` |
| `co_ban` | char(6) | NULL | — | FK → `saBanco.co_ban` |
| `forma_pag` | char(2) | NOT NULL | — | — |
| `cod_cta` | char(6) | NULL | — | FK → `saCuentaBancaria.cod_cta` |
| `cod_caja` | char(6) | NULL | — | FK → `saCaja.cod_caja` |
| `co_vale` | char(6) | NULL | b'Codigo del vale alimentacion' | FK → `pvValeAlimentacion.co_vale` |
| `mov_num_c` | char(20) | NULL | — | FK → `saMovimientoCaja.mov_num` |
| `mov_num_b` | char(20) | NULL | — | FK → `saMovimientoBanco.mov_num` |
| `num_doc` | char(20) | NULL | — | — |
| `devuelto` | bit(1,0) | NOT NULL | — | — |
| `mont_doc` | decimal(18,2) | NOT NULL | — | — |
| `fecha_che` | smalldatetime(16,0) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saCobroTPReng_pvValeAlimentacion`: `co_vale` → `pvValeAlimentacion.co_vale`
- `FK_saCobroTPReng_saBanco`: `co_ban` → `saBanco.co_ban`
- `FK_saCobroTPReng_saCaja`: `cod_caja` → `saCaja.cod_caja`
- `FK_saCobroTPReng_saCobro`: `cob_num` → `saCobro.cob_num`
- `FK_saCobroTPReng_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
- `FK_saCobroTPReng_saMovimientoBanco`: `mov_num_b` → `saMovimientoBanco.mov_num`
- `FK_saCobroTPReng_saMovimientoCaja`: `mov_num_c` → `saMovimientoCaja.mov_num`
- `FK_saCobroTPReng_saTarjetaCredito`: `co_tar` → `saTarjetaCredito.co_tar`
