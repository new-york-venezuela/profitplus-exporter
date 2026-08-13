# Tabla: saPlantillaCompraReqRelacion
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_reng_req` | uniqueidentifier | NOT NULL | — | — |
| `rowguid_reng_imp` | uniqueidentifier | NOT NULL | — | — |
| `co_tipo_doc` | char(4) | NOT NULL | — | FK Implícita → `saTipoDocumento.co_tipo_doc` |
| `entregado` | bit(1,0) | NOT NULL | — | — |
| `fecha_real_entrega` | smalldatetime(16,0) | NULL | — | — |
| `total_art` | decimal(18,5) | NULL | — | — |
| `comentario` | varchar(512) | NULL | — | — |
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
