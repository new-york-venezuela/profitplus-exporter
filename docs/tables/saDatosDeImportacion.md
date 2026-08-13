# Tabla: saDatosDeImportacion
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_factura_renglon` | uniqueidentifier | NOT NULL | b'Rowguid del rengl\xc3\xb3n de la Factura al Tesoro Nacional' | FK → `saFacturaCompraReng.rowguid` |
| `fact_num` | char(20) | NOT NULL | b'N\xc3\xbamero de Factura de Importaci\xc3\xb3n' | FK → `saFacturaCompra.doc_num` |
| `bl_awb_cpi` | varchar(60) | NULL | b'BL/AWB/CPI' | — |
| `tasa` | int(10,0) | NULL | b'Tipo Impuesto' | — |
| `total_imp` | decimal(18,5) | NULL | b'Monto del Impuesto' | — |
| `tasa_valor` | decimal(21,8) | NULL | b'Porcentaje del impuesto' | — |
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
- `FK_saDatosDeImportacion_saFacturaCompra`: `fact_num` → `saFacturaCompra.doc_num`
- `FK_saDatosDeImportacion_saFacturaCompraReng`: `rowguid_factura_renglon` → `saFacturaCompraReng.rowguid`
