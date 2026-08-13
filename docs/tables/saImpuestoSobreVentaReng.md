# Tabla: saImpuestoSobreVentaReng
**Módulo**: Fiscal
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `fecha` | smalldatetime(16,0) | NOT NULL | — | FK → `saImpuestoSobreVenta.fecha` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `tipo_imp` | char(1) | NOT NULL | b'Tipo de impuesto (1) aplicado' | — |
| `ventas` | bit(1,0) | NOT NULL | — | — |
| `compras` | bit(1,0) | NOT NULL | — | — |
| `consumo_suntuario` | bit(1,0) | NOT NULL | — | — |
| `porc_tasa` | decimal(18,5) | NOT NULL | — | — |
| `porc_suntuario` | decimal(18,5) | NOT NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saImpuestoSobreVentaReng_saImpuestoSobreVenta`: `fecha` → `saImpuestoSobreVenta.fecha`
