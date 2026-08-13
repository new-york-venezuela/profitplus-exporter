# Tabla: saCuentaBancaria
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_cta` | char(6) | NOT NULL | b'Codigo de la cuenta bancaria' | — |
| `co_ban` | char(6) | NOT NULL | b'C\xc3\xb3digo del banco asociado' | FK → `saBanco.co_ban` |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `num_cta` | varchar(50) | NOT NULL | b'N\xc3\xbamero de la cuenta' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `telefonos` | varchar(60) | NULL | b'Informaci\xc3\xb3n sobre telefonos' | — |
| `sucursal` | varchar(60) | NULL | b'Nombre de la agencia al cual pertenece la cuenta' | — |
| `mes_ini` | smalldatetime(16,0) | NOT NULL | b'Fecha de inicio' | — |
| `inactivo` | bit(1,0) | NOT NULL | b'Indicativo de registro inactivo' | — |
| `usa_chra` | bit(1,0) | NOT NULL | b'Cuenta maneja chequera' | — |
| `ejec_cu` | varchar(30) | NULL | b'Ejecutivo de la cuenta' | — |
| `direccion` | varchar(max) | NULL | b'Direcci\xc3\xb3n' | — |
| `email` | varchar(60) | NULL | b'Correo electronico' | — |
| `tipo_cu` | varchar(30) | NOT NULL | b'Tipo de Cuenta (fijo= CTA). A: AHORRO, C: CORRIENTE' | — |
| `fecini` | smalldatetime(16,0) | NOT NULL | b'Fecha de la ultima conciliacion' | — |
| `fec_chra` | smalldatetime(16,0) | NOT NULL | b'Fecha de inicia de uso de la chequera' | — |
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
| `aux_imp01` | decimal(18,5) | NULL | — | — |
| `aux_imp02` | decimal(18,5) | NULL | — | — |

## Triggers Relacionados
- `TrigEstado_saCuentaBancaria`

## Foreign Keys (explícitas)
- `FK_saCuentaBancaria_saBanco`: `co_ban` → `saBanco.co_ban`
- `FK_saCuentaBancaria_saMoneda`: `co_mone` → `saMoneda.co_mone`
