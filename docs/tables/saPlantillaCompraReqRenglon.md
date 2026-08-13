# Tabla: saPlantillaCompraReqRenglon
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_plantilla_renglon` | uniqueidentifier | NOT NULL | — | FK → `saPlantillaCompraReng.rowguid` |
| `fecha_requerida` | smalldatetime(16,0) | NULL | — | — |
| `fecha_real_entrega` | smalldatetime(16,0) | NULL | — | — |
| `comentario` | varchar(512) | NULL | — | — |
| `satisface` | bit(1,0) | NOT NULL | — | — |
| `estatus` | char(1) | NULL | b'0 = sin procesar, 1 = parcialmente procesado, 2 = procesado' | — |
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
- `FK_saPlantillaCompraReqRenglon_saPlantillaCompraReng`: `rowguid_plantilla_renglon` → `saPlantillaCompraReng.rowguid`
