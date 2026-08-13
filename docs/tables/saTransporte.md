# Tabla: saTransporte
**Módulo**: Clientes
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_tran` | char(6) | NOT NULL | b'Codigo de transporte' | — |
| `des_tran` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n del Tipo de Transporte' | — |
| `resp_tra` | varchar(60) | NULL | b'Responsable del Transporte' | — |
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
| `identificador_1` | varchar(100) | NULL | b'tipo de transporte' | — |
| `identificador_2` | varchar(100) | NULL | b'marca / modelo' | — |
| `identificador_3` | varchar(100) | NULL | b'placa del transporte' | — |
| `ident_responsable` | varchar(100) | NULL | b'identificador del transportista (datos del transportista)' | — |
| `tipoIdRespon` | int(10,0) | NULL | — | — |
| `colorTransp` | varchar(100) | NULL | — | — |
| `telefono` | varchar(100) | NULL | — | — |
| `contacto` | varchar(100) | NULL | — | — |
| `nomApelCond` | varchar(200) | NULL | — | — |
| `tipoIdCond` | int(10,0) | NULL | — | — |
| `identificadorCond` | varchar(100) | NULL | — | — |
| `contactoCond` | varchar(100) | NULL | — | — |
| `tipoLicCond` | varchar(30) | NULL | — | — |
| `clasificacion` | char(1) | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_
