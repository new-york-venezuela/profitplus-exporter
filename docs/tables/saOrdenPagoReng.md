# Tabla: saOrdenPagoReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `ord_num` | char(20) | NOT NULL | b'N\xc3\xbamero Correlativo para las ordenes de pago' | FK → `saOrdenPago.ord_num` |
| `co_cta_ingr_egr` | char(20) | NOT NULL | b'C\xc3\xb3digo de la cuenta de egreso' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `co_islr` | char(6) | NULL | — | FK → `saConISLR.co_islr` |
| `monto_d` | decimal(18,5) | NOT NULL | b'Monto del debe' | — |
| `monto_h` | decimal(18,5) | NOT NULL | b'monto del haber' | — |
| `monto_iva` | decimal(18,5) | NOT NULL | — | — |
| `porc_retn` | decimal(18,5) | NOT NULL | b'Porcentaje de Retencion' | — |
| `monto_obj` | decimal(20,5) | NULL | — | — |
| `sustraendo` | decimal(18,5) | NOT NULL | — | — |
| `monto_reten` | decimal(18,5) | NOT NULL | — | — |
| `tipo_imp` | char(1) | NOT NULL | b'Tipo de impuesto (1) aplicado' | — |
| `descrip` | varchar(max) | NULL | b'Descripci\xc3\xb3n del registro o documento' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
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
- `FK_saOrdenPagoReng_saConISLR`: `co_islr` → `saConISLR.co_islr`
- `FK_saOrdenPagoReng_saCuentaIngEgr`: `co_cta_ingr_egr` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_saOrdenPagoReng_saOrdenPago`: `ord_num` → `saOrdenPago.ord_num`
