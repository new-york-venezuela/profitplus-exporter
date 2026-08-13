# Tabla: saConsecutivo
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_emp` | char(20) | NULL | b'Codigo de la empresa' | FK → `par_emp.cod_emp` |
| `co_sucur` | char(6) | NULL | b'Codigo de la sucursal' | FK → `saSucursal.co_sucur` |
| `codigo` | char(20) | NOT NULL | b'Codigo del consecutivo (campo calculado = igual al de sucursal o al de la empresa)' | — |
| `co_consecutivo` | char(16) | NOT NULL | b'Codigo de la serie (consecutivo)' | FK → `saConsecutivoTipo.co_consecutivo` |
| `co_serie` | char(20) | NULL | b'Valor del ultimo cosecutivo almacenado para un campo' | FK → `saSerie.co_serie` |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saConsecutivo_par_emp`: `co_emp` → `par_emp.cod_emp`
- `FK_saConsecutivo_saConsecutivoTipo`: `co_consecutivo` → `saConsecutivoTipo.co_consecutivo`
- `FK_saConsecutivo_saSerie`: `co_serie` → `saSerie.co_serie`
- `FK_saConsecutivo_saSucursal`: `co_sucur` → `saSucursal.co_sucur`
