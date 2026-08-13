# Tabla: saFacturaCompraImportacion
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `doc_num` | char(20) | NOT NULL | b'N\xc3\xbamero de Documento' | — |
| `co_tipo_doc` | char(6) | NOT NULL | b'Tipo de Documento "FACT" o "PLAN"' | FK Implícita → `saTipoDocumento.co_tipo_doc` |
| `num_plan_impor` | char(40) | NULL | b'N\xc3\xbamero de Planilla de Importaci\xc3\xb3n' | — |
| `num_exp_impor` | char(40) | NULL | b'N\xc3\xbamero de Expediente de Importaci\xc3\xb3n' | — |
| `co_incoterm` | char(6) | NULL | b'C\xc3\xb3digo del Incoterm' | FK → `saIncoterm.co_incoterm` |
| `lugarEmbarque` | char(60) | NULL | b'Lugar de Embarque' | — |
| `lugarDesembarque` | char(60) | NULL | b'Lugar de Desembarque' | — |
| `empresaTransporte` | char(60) | NULL | b'Empresa de transporte' | — |
| `documentacion` | char(60) | NULL | b'Documentaci\xc3\xb3n' | — |
| `condicionesSeguro` | char(60) | NULL | b'Condiciones del seguro' | — |
| `empaque` | char(60) | NULL | b'Empaque' | — |
| `marcas` | char(60) | NULL | b'Marcas' | — |
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
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saFacturaCompraImportacion_saIncoterm`: `co_incoterm` → `saIncoterm.co_incoterm`
