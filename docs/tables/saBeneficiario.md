# Tabla: saBeneficiario
**Módulo**: Clientes
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_ben` | char(10) | NOT NULL | b'C\xc3\xb3digo del beneficiario relacionado' | — |
| `ben_des` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n del Beneficiario' | — |
| `rif` | varchar(18) | NULL | b'Registro de Informaci\xc3\xb3n Fiscal' | — |
| `nit` | varchar(18) | NULL | b'N\xc3\xbamero de Informaci\xc3\xb3n Tributaria' | — |
| `telefonos` | varchar(60) | NULL | b'Tel\xc3\xa9fono' | — |
| `direc1` | varchar(max) | NULL | b'Direcci\xc3\xb3n' | — |
| `tipo_per` | char(1) | NOT NULL | b'Tipo de Persona' | FK → `saTabuladorIslr.tipo_per` |
| `co_tab` | char(20) | NULL | b'C\xc3\xb3digo Tabulador del I.S.L.R.' | FK → `saTabuladorIslr.co_tab` |
| `inactivo` | bit(1,0) | NOT NULL | b'Indicativo de registro inactivo' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
- `TrigEstado_saBeneficiario`

## Foreign Keys (explícitas)
- `FK_saBeneficiario_saTabuladorIslr`: `co_tab` → `saTabuladorIslr.co_tab`
- `FK_saBeneficiario_saTabuladorIslr`: `tipo_per` → `saTabuladorIslr.tipo_per`
