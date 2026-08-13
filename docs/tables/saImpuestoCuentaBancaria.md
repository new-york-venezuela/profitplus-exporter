# Tabla: saImpuestoCuentaBancaria
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `tipo_imp` | char(3) | NOT NULL | b'Tipo de  Impuesto' | — |
| `fecha_regis` | smalldatetime(16,0) | NOT NULL | b'fecha de registro' | — |
| `valor_porcent` | decimal(21,8) | NOT NULL | b'Valor en Porcentaje del Impuesto' | — |
| `monto_adic` | decimal(18,5) | NULL | — | — |
| `cod_cta` | char(6) | NOT NULL | — | FK → `saCuentaBancaria.cod_cta` |
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
- `FK_saImpuestoCuentaBancaria_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
