# Tabla: saDocumentoElectronico
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_doc_elec` | char(20) | NOT NULL | b'C\xc3\xb3digo de documento electr\xc3\xb3nico' | — |
| `des_doc_elec` | varchar(60) | NULL | b'Descripci\xc3\xb3n de documento electr\xc3\xb3nico' | — |
| `fec_doc_elec` | smalldatetime(16,0) | NOT NULL | b'Fecha de documento electr\xc3\xb3nico' | — |
| `co_grupo_rep` | char(6) | NOT NULL | b'C\xc3\xb3digo de grupo de reporte' | — |
| `co_reporte` | char(6) | NOT NULL | b'C\xc3\xb3digo de reporte' | — |
| `sp_doc_elec` | char(128) | NULL | b'Nombre del stored procedure' | — |
| `doc_num_desde` | char(20) | NULL | b'N\xc3\xbamero }documento' | — |
| `doc_num_hasta` | char(20) | NULL | b'N\xc3\xbamero documento' | — |
| `fec_emis_desde` | smalldatetime(16,0) | NULL | b'Fecha emisi\xc3\xb3n documento' | — |
| `fec_emis_hasta` | smalldatetime(16,0) | NULL | b'Fecha emisi\xc3\xb3n documento' | — |
| `fec_venc_desde` | smalldatetime(16,0) | NULL | b'Fecha vencimiento documento' | — |
| `fec_venc_hasta` | smalldatetime(16,0) | NULL | b'Fecha vencimiento documento' | — |
| `co_cli_desde` | char(16) | NULL | b'C\xc3\xb3digo cliente' | FK → `saCliente.co_cli` |
| `co_cli_hasta` | char(16) | NULL | b'C\xc3\xb3digo cliente' | FK → `saCliente.co_cli` |
| `co_prov_desde` | char(16) | NULL | b'C\xc3\xb3digo proveedor' | FK → `saProveedor.co_prov` |
| `co_prov_hasta` | char(16) | NULL | b'C\xc3\xb3digo proveedor' | FK → `saProveedor.co_prov` |
| `status` | char(1) | NULL | b'Estatus del documento' | — |
| `tipo_doc_salida` | int(10,0) | NULL | b'Formato de envio del documento' | — |
| `enviarcorreo` | bit(1,0) | NOT NULL | b'Enviar Correo' | — |
| `mantenerarchivos` | bit(1,0) | NOT NULL | b'Mantener archivos' | — |
| `ruta_arch` | varchar(1024) | NULL | b'Ubicaci\xc3\xb3n del archivo' | — |
| `correo_asunto` | varchar(1024) | NULL | b'Asunto del correo' | — |
| `correo_cc` | varchar(1024) | NULL | b'Enviar correo con copia' | — |
| `correo_bcc` | varchar(1024) | NULL | b'Enviar correo con copia oculta' | — |
| `correo_cuerpo` | varchar(1024) | NULL | b'Cuerpo del correo' | — |
| `correo_firma` | varchar(1024) | NULL | b'Firma del correo' | — |
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
| `trasnfe` | char(1) | NULL | b'Reservado por el sistemaReservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NULL | b'Identificador Unico' | — |
| `procesado` | bit(1,0) | NOT NULL | b'Procesado' | — |
| `Log` | xml | NULL | b'Log' | — |
| `tipo_documento` | char(10) | NOT NULL | b'Tipo de documento' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saDocumentoElectronico_saClienteDesde`: `co_cli_desde` → `saCliente.co_cli`
- `FK_saDocumentoElectronico_saClienteHasta`: `co_cli_hasta` → `saCliente.co_cli`
- `FK_saDocumentoElectronico_saProveedorDesde`: `co_prov_desde` → `saProveedor.co_prov`
- `FK_saDocumentoElectronico_saProveedorHasta`: `co_prov_hasta` → `saProveedor.co_prov`
