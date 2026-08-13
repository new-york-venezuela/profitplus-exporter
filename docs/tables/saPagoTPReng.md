# Tabla: saPagoTPReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `cob_num` | char(20) | NOT NULL | b'N\xc3\xbamero del pago' | FK → `saPago.cob_num` |
| `forma_pag` | char(2) | NOT NULL | b'Forma de Pago' | — |
| `cod_cta` | char(6) | NULL | b'Codigo de la cuenta bancaria' | FK → `saCuentaBancaria.cod_cta` |
| `cod_caja` | char(6) | NULL | b'C\xc3\xb3digo de la Caja' | FK → `saCaja.cod_caja` |
| `mov_num_c` | char(20) | NULL | b'C\xc3\xb3digo de Movimiento creado en Banco' | FK → `saMovimientoCaja.mov_num` |
| `mov_num_b` | char(20) | NULL | — | FK → `saMovimientoBanco.mov_num` |
| `num_doc` | char(20) | NULL | b'Numero de documento del cual fue importado (referencia, usar rowguid_doc)' | — |
| `devuelto` | bit(1,0) | NOT NULL | b'Si hubo cheque devuelto' | — |
| `mont_doc` | decimal(18,2) | NOT NULL | b'Monto del rengl\xc3\xb3n de Pago' | — |
| `fecha_che` | smalldatetime(16,0) | NOT NULL | b'Fecha del Cheque' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saPagoTPReng_saCaja`: `cod_caja` → `saCaja.cod_caja`
- `FK_saPagoTPReng_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
- `FK_saPagoTPReng_saMovimientoBanco`: `mov_num_b` → `saMovimientoBanco.mov_num`
- `FK_saPagoTPReng_saMovimientoCaja`: `mov_num_c` → `saMovimientoCaja.mov_num`
- `FK_saPagoTPReng_saPago`: `cob_num` → `saPago.cob_num`
