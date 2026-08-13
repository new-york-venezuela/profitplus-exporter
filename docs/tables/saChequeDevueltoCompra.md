# Tabla: saChequeDevueltoCompra
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_cheq_dev` | char(20) | NOT NULL | — | — |
| `des_cheq_dev` | varchar(60) | NULL | — | — |
| `co_prov` | char(16) | NOT NULL | — | FK → `saProveedor.co_prov` |
| `fecha` | smalldatetime(16,0) | NOT NULL | — | — |
| `num_doc` | char(20) | NOT NULL | — | — |
| `incluye_imp` | bit(1,0) | NOT NULL | — | — |
| `cod_cta` | char(6) | NULL | — | — |
| `co_tipo_doc` | char(6) | NULL | — | FK → `saDocumentoCompra.co_tipo_doc` |
| `nro_doc` | char(20) | NULL | — | FK → `saDocumentoCompra.nro_doc` |
| `mont_doc` | decimal(18,2) | NOT NULL | — | — |
| `fec_cheq` | smalldatetime(16,0) | NOT NULL | — | — |
| `co_ban` | char(6) | NOT NULL | — | FK Implícita → `saBanco.co_ban` |
| `tip_imp` | char(1) | NULL | — | — |
| `procesado` | bit(1,0) | NOT NULL | — | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
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
- `FK_saChequeDevueltoCompra_saDocumentoCompra`: `co_tipo_doc` → `saDocumentoCompra.co_tipo_doc`
- `FK_saChequeDevueltoCompra_saDocumentoCompra`: `nro_doc` → `saDocumentoCompra.nro_doc`
- `FK_saChequeDevueltoCompra_saProveedor`: `co_prov` → `saProveedor.co_prov`
