# Tabla: saGiroCompraReng
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_giro` | char(20) | NOT NULL | — | FK → `saGiroCompra.co_giro` |
| `reng_num` | int(10,0) | NOT NULL | — | — |
| `co_tipo_doc` | char(6) | NOT NULL | — | FK → `saDocumentoCompra.co_tipo_doc` |
| `nro_doc` | char(20) | NOT NULL | — | FK → `saDocumentoCompra.nro_doc` |
| `monto_cob` | decimal(18,2) | NOT NULL | — | — |
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
- `FK_saGiroCompraReng_saGiroCompra`: `co_giro` → `saGiroCompra.co_giro`
- `FK_saGiroCompraReng_saDocumentoCompra`: `co_tipo_doc` → `saDocumentoCompra.co_tipo_doc`
- `FK_saGiroCompraReng_saDocumentoCompra`: `nro_doc` → `saDocumentoCompra.nro_doc`
