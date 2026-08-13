# Tabla: saNCFInfoDocCompra
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `tipo_doc` | char(6) | NOT NULL | — | FK → `saDocumentoCompra.co_tipo_doc` |
| `nro_doc` | char(20) | NOT NULL | — | FK → `saDocumentoCompra.nro_doc` |
| `co_serie` | char(20) | NULL | — | FK → `saSerie.co_serie` |
| `ncf` | varchar(19) | NULL | — | — |
| `tipo_doc_Ori` | char(6) | NULL | — | — |
| `nro_doc_Ori` | char(20) | NULL | — | — |
| `co_gasto` | char(2) | NULL | — | FK → `saTipoGasto.co_gasto` |
| `anulado` | bit(1,0) | NOT NULL | — | — |
| `co_anulacion` | char(4) | NULL | — | FK → `saTipoAnulacionVenta.co_anulacion` |
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
| `trasnfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NOT NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saNCFInfoDocCompra_saDocumentoCompra`: `tipo_doc` → `saDocumentoCompra.co_tipo_doc`
- `FK_saNCFInfoDocCompra_saDocumentoCompra`: `nro_doc` → `saDocumentoCompra.nro_doc`
- `FK_saNCFInfoDocCompra_saTipoAnulacionVenta`: `co_anulacion` → `saTipoAnulacionVenta.co_anulacion`
- `FK_saNCFInfoDocCompra_saSerie`: `co_serie` → `saSerie.co_serie`
- `FK_saNCFInfoDocCompra_saTipoGasto`: `co_gasto` → `saTipoGasto.co_gasto`
