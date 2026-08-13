# Tabla: saGiroVenta
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_giro` | char(20) | NOT NULL | — | — |
| `des_giro` | varchar(60) | NULL | — | — |
| `co_cli` | char(16) | NOT NULL | — | FK Implícita → `saCliente.co_cli` |
| `co_ven` | char(6) | NOT NULL | — | FK Implícita → `saVendedor.co_ven` |
| `fecha` | smalldatetime(16,0) | NOT NULL | — | — |
| `cant_giro` | int(10,0) | NOT NULL | — | — |
| `Frecuencia` | char(2) | NOT NULL | — | — |
| `fec_p_giro` | smalldatetime(16,0) | NOT NULL | — | — |
| `porc_interes` | decimal(18,2) | NOT NULL | — | — |
| `cob_num` | char(20) | NULL | — | — |
| `co_tipo_doc` | char(6) | NULL | — | FK Implícita → `saTipoDocumento.co_tipo_doc` |
| `nro_doc` | char(20) | NULL | — | — |
| `mont_doc` | decimal(18,2) | NOT NULL | — | — |
| `procesado` | bit(1,0) | NOT NULL | — | — |
| `campo1` | varchar(60) | NULL | — | — |
| `campo2` | varchar(60) | NULL | — | — |
| `campo3` | varchar(60) | NULL | — | — |
| `campo4` | varchar(60) | NULL | — | — |
| `campo5` | varchar(60) | NULL | — | — |
| `campo6` | varchar(60) | NULL | — | — |
| `campo7` | varchar(60) | NULL | — | — |
| `campo8` | varchar(60) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NOT NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_
