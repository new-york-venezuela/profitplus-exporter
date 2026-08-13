# Tabla: saConciliacionAutoReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_auto_con` | char(6) | NOT NULL | b'Codigo de la conciliacion automatica' | — |
| `cod_cta` | char(6) | NOT NULL | b'Codigo de la cuenta bancaria' | FK → `saCuentaBancaria.cod_cta` |
| `mesArchivo` | int(10,0) | NOT NULL | b'Mes de la conciliacion' | — |
| `anoArchivo` | int(10,0) | NOT NULL | b'Ano de la conciliacion' | — |
| `fecImpor` | datetime(23,3) | NOT NULL | b'Fecha de importacion del archivo' | — |
| `status` | char(3) | NOT NULL | — | — |
| `archivo` | varbinary | NULL | b'Binario del archivo importado' | — |
| `saldoEc` | decimal(18,5) | NOT NULL | — | — |
| `tamanoPaquete` | int(10,0) | NOT NULL | — | — |
| `totalMov` | int(10,0) | NOT NULL | b'Total de Movimientos Cargados' | — |
| `totalCon` | int(10,0) | NOT NULL | b'Total de movimientos vonciliados' | — |
| `totalRep` | int(10,0) | NOT NULL | b'Total de movimientos repetidos' | — |
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
- `FK_saConciliacionAutoReng_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
