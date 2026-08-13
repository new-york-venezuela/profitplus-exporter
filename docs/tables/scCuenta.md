# Tabla: scCuenta
**Módulo**: Contabilidad
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_cue` | char(20) | NOT NULL | b'C\xc3\xb3digo de la cuenta contable' | — |
| `des_cue` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n de la cuenta contable.' | — |
| `detalle` | bit(1,0) | NOT NULL | b'Detalle.Identificador de que la cuenta es de movimiento o no.' | — |
| `aj_islr` | bit(1,0) | NOT NULL | b'Ajuste fiscal .Identificador de que a la cuenta contable se le aplicar\xc3\xa1 el ajuste fiscal.' | — |
| `me_islr` | int(10,0) | NOT NULL | b'M\xc3\xa9todo del ajuste fiscal.Identificador de el tipo de m\xc3\xa9todo que se utilizar\xc3\xa1 para el c\xc3\xa1lculo de el ajuste: 1(normal), 2(simple) o 3(otro).' | — |
| `aj_dpc` | bit(1,0) | NOT NULL | b'Ajuste DPC10.Identificador de que la cuenta contable se le aplicar\xc3\xa1 el ajuste DPC10.' | — |
| `me_dpc` | int(10,0) | NOT NULL | b'M\xc3\xa9todo para el c\xc3\xa1lculo del ajuste DPC10.Tipo de m\xc3\xa9todo utilizado para el c\xc3\xa1lculo del ajuste  DPC10:  1(normal), 2(simple) o 3(otro).' | — |
| `opciones` | int(10,0) | NOT NULL | b'Tipo de cuenta.Tipo de cuenta : 0(Monetario) ,1 (No monetaria).' | — |
| `saldo_ini` | decimal(18,2) | NULL | b'Saldo inicial.Monto inicial de la cuenta .' | — |
| `saldan` | decimal(18,2) | NOT NULL | b'Saldo anterior.Monto anterior inicial de la cuenta contable .(no se encuentra actualmente en uso).' | — |
| `centro_co` | char(6) | NOT NULL | b'C\xc3\xb3digo del centro de costo.Este campo se relaciona a la tabla SCCENTRO  a trav\xc3\xa9s de el campo CO_CEN de la tabla.' | — |
| `moneda_adi` | bit(1,0) | NOT NULL | b'Moneda adicional.Identificador de que la cuenta contable utilizar\xc3\xa1 moneda adicional.' | — |
| `man_aux` | bit(1,0) | NOT NULL | b'Maneja auxiliar. Identificador de que la cuenta contable maneja auxiliares.' | — |
| `tipoaux` | char(1) | NULL | b'Tipo de auxiliar.Tipos de auxiliar: C(cliente),P(proveedor),O(otro),T(trabajador).' | — |
| `man_doc` | bit(1,0) | NOT NULL | b'Maneja documento.Identificador de que las cuentas manejan documentos. .' | — |
| `man_fecdoc` | bit(1,0) | NOT NULL | b'Maneja fecha de documento.Identificador de que las cuentas manejan fecha de documento.' | — |
| `cue_gasto` | bit(1,0) | NOT NULL | b'Cuenta de gasto.Identificador de que las cuentas contables  manejan cuentas de gasto .' | — |
| `co_gas` | char(6) | NULL | b'C\xc3\xb3digo de la cuenta de gasto.Este campo se relaciona a la tabla SCGASTOS  a trav\xc3\xa9s de el campo CO_GAS de la tabla.' | — |
| `man_adi` | bit(1,0) | NOT NULL | b'Maneja atributos 1.Identificador de que se manejan atributo 1.' | — |
| `co_tab` | char(6) | NULL | b'C\xc3\xb3digo del tipo de atributo.Este campo se relaciona a la tabla SCTABADI  a trav\xc3\xa9s de el campo CO_TAB de la tabla.' | — |
| `man_adi2` | bit(1,0) | NOT NULL | b'Maneja atributos 2.Identificador de que se manejan atributo 2.' | — |
| `co_tab2` | char(6) | NULL | b'C\xc3\xb3digo del tipo de atributo 2.Este campo se relaciona a la tabla SCTABADI  a trav\xc3\xa9s de el campo CO_TAB de la tabla.' | — |
| `man_adi3` | bit(1,0) | NOT NULL | b'Maneja atributos 3.Identificador de que se manejan atributo 3.' | — |
| `co_tab3` | char(6) | NULL | b'C\xc3\xb3digo del tipo de atributo 3.Este campo se relaciona a la tabla SCTABADI  a trav\xc3\xa9s de el campo CO_TAB de la tabla.' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `inactivo` | bit(1,0) | NOT NULL | b'Indicativo de registro inactivo' | — |
| `fec_inac` | smalldatetime(16,0) | NULL | b'Fecha en la que se coloc\xc3\xa1 inactiva una cuenta contable.' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `co_cuepadre` | char(20) | NULL | b'Cuenta Padre' | — |
| `tipo_pat` | int(10,0) | NOT NULL | b'Tipo de patrimonio: 1.Capital social y otras cuentas similares 2.Utilidades no distribuidas 3.Otras cuentas de patrimonio' | — |
| `flujo_efe` | bit(1,0) | NOT NULL | b'Campo l\xc3\xb6gico utilizado para indicar si la cuenta maneja flujo de efectivo.' | — |
| `afecta_pm` | bit(1,0) | NOT NULL | b'Campo l\xc3\xb3gico utilizado para indicar si la cuenta afecta la posesi\xc3\xb3n monetaria.' | — |
| `tipo_inv` | int(10,0) | NOT NULL | b'Tipo de inventario' | — |
| `ipc_islr` | int(10,0) | NOT NULL | b'Tipo de IPC empleado en el ajuste fiscal' | — |
| `ipc_dpc` | int(10,0) | NOT NULL | b'Tipo de IPC empleado en el ajuste por DPC-10' | — |
| `exc_pat` | bit(1,0) | NOT NULL | b'Exclusiones fiscales historicas al patrimonio' | — |
| `meses_rotacion` | int(10,0) | NOT NULL | b'N\xc3\xbamero de meses por rotaci\xc3\xb3n de inventario utilizados para el ajuste por inflaci\xc3\xb3n' | — |
| `validador` | timestamp | NULL | b'Marca de tiempo usada en el control de concurrencia' | — |

## Triggers Relacionados
_Ninguno_
