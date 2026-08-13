# Tabla: saTipoDocumento
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_tipo_doc` | char(6) | NOT NULL | — | — |
| `descrip` | varchar(60) | NOT NULL | — | — |
| `tipo_mov` | char(2) | NOT NULL | — | — |
| `usar_ventas` | bit(1,0) | NOT NULL | — | — |
| `usar_compras` | bit(1,0) | NOT NULL | — | — |
| `registro_sistema` | bit(1,0) | NOT NULL | — | — |
| `num_fact_fis_venta` | bit(1,0) | NOT NULL | — | — |
| `num_cont_venta` | bit(1,0) | NOT NULL | — | — |
| `serial_imp_fis_venta` | bit(1,0) | NOT NULL | — | — |
| `reng_venta` | bit(1,0) | NOT NULL | — | — |
| `num_iva_venta` | bit(1,0) | NOT NULL | — | — |
| `reac_doc_Compra` | bit(1,0) | NOT NULL | — | — |
| `reac_doc_Venta` | bit(1,0) | NOT NULL | — | — |
| `anul_doc_venta` | bit(1,0) | NOT NULL | — | — |
| `anul_doc_compra` | bit(1,0) | NOT NULL | — | — |
| `doc_prov_compra` | bit(1,0) | NOT NULL | — | — |
| `num_control_compra` | bit(1,0) | NOT NULL | — | — |
| `reng_compra` | bit(1,0) | NOT NULL | — | — |
| `num_iva_compra` | bit(1,0) | NOT NULL | — | — |
| `manual_venta` | bit(1,0) | NOT NULL | — | — |
| `manual_compra` | bit(1,0) | NOT NULL | — | — |
| `doc_asoc_compra` | bit(1,0) | NOT NULL | — | — |
| `doc_asoc_venta` | bit(1,0) | NOT NULL | — | — |
| `act_prog_pago` | bit(1,0) | NOT NULL | — | — |
| `aplica_dxpp_venta` | bit(1,0) | NOT NULL | — | — |
| `aplica_dxpp_compra` | bit(1,0) | NOT NULL | — | — |
| `aplica_riva_venta` | bit(1,0) | NOT NULL | — | — |
| `aplica_riva_compra` | bit(1,0) | NOT NULL | — | — |
| `tipo_imp` | char(1) | NOT NULL | b'Tipo de impuesto (1) aplicado' | — |
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
