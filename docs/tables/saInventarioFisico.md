# Tabla: saInventarioFisico
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_invfisico` | char(20) | NOT NULL | b'Campo identificador del Inventario fisico' | — |
| `des_invfisico` | varchar(60) | NULL | b'Descripci\xc3\xb3n del inventario fisico' | — |
| `co_alma` | char(6) | NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |
| `inicio` | smalldatetime(16,0) | NOT NULL | b'Fecha y Hora de inicio del inventario fisico' | — |
| `cierre` | smalldatetime(16,0) | NULL | b'Fecha y Hora de cierre del inventario fisico' | — |
| `art_cero` | bit(1,0) | NOT NULL | b'Indica si los articulos no ingresados en el inventario se colocaran en cero (0)' | — |
| `ajue_num` | char(20) | NULL | b'indica el numero de ajuste generado por las diferencias en el inventario' | — |
| `co_tipo_ent` | char(6) | NULL | b'Tipo de Ajuste de Entrada' | FK → `saTipoAjuste.co_tipo` |
| `co_tipo_sal` | char(6) | NULL | b'Tipo de Ajuste de Salida' | FK → `saTipoAjuste.co_tipo` |
| `procesado` | bit(1,0) | NOT NULL | b'indica si el inventario esta o no cerrado. Cerrado (True), Iniciado (False)' | — |
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
- `TrigEstado_saInventarioFisico`

## Foreign Keys (explícitas)
- `FK_saInventarioFisico_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saInventarioFisico_saTipoAjuste1`: `co_tipo_ent` → `saTipoAjuste.co_tipo`
- `FK_saInventarioFisico_saTipoAjuste2`: `co_tipo_sal` → `saTipoAjuste.co_tipo`
