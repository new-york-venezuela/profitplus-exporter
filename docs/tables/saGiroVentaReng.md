# Tabla: saGiroVentaReng
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_giro` | char(20) | NOT NULL | — | FK → `saGiroVenta.co_giro` |
| `reng_num` | int(10,0) | NOT NULL | — | — |
| `co_tipo_doc` | char(6) | NOT NULL | — | FK → `saDocumentoVenta.co_tipo_doc` |
| `nro_doc` | char(20) | NOT NULL | — | FK → `saDocumentoVenta.nro_doc` |
| `monto_cob` | decimal(18,2) | NOT NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saGiroVentaReng_saGiroVenta`: `co_giro` → `saGiroVenta.co_giro`
- `FK_saGiroVentaReng_saDocumentoVenta`: `co_tipo_doc` → `saDocumentoVenta.co_tipo_doc`
- `FK_saGiroVentaReng_saDocumentoVenta`: `nro_doc` → `saDocumentoVenta.nro_doc`
