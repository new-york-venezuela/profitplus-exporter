# Tabla: saPlantillaCompraReq
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_plantilla_compra` | uniqueidentifier | NOT NULL | — | FK → `saPlantillaCompra.rowguid` |
| `co_ubicacion` | char(6) | NOT NULL | — | FK → `saUbicacion.co_ubicacion` |
| `autorizado` | varchar(128) | NULL | — | — |
| `descripcion` | varchar(128) | NULL | — | — |
| `responsable` | varchar(128) | NULL | — | — |
| `email` | varchar(128) | NULL | — | — |
| `fecha` | smalldatetime(16,0) | NULL | — | — |
| `estatus` | char(1) | NOT NULL | b'0 = sin procesar, 1 = parcialmente procesado, 2 = procesado' | — |
| `telefono` | varchar(128) | NULL | — | — |
| `direccion` | varchar(512) | NULL | — | — |
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
- `FK_saPlantillaCompraReq_saPlantillaCompra`: `rowguid_plantilla_compra` → `saPlantillaCompra.rowguid`
- `FK_saPlantillaCompraReq_saUbicacion`: `co_ubicacion` → `saUbicacion.co_ubicacion`
