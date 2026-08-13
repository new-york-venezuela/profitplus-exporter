# Tabla: saConsecutivoTipo
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_consecutivo` | char(16) | NOT NULL | b'Codigo de la serie (consecutivo)' | — |
| `des_consecutivo` | varchar(60) | NOT NULL | b'Descripcion de la serie (consecutivo)' | — |
| `UsoEmpresa` | bit(1,0) | NOT NULL | b'Indica si la serie es aplicada a nivel de empresa' | — |
| `UsoSucursal` | bit(1,0) | NOT NULL | b'Indica si la serie es aplicada a nivel de sucursal' | — |
| `Modulo` | char(1) | NOT NULL | b'I: Inventario, Venta y CxC, C: Caja y Banco, Compra y CxP, T: Tablas B\xc3\xa1sicas' | — |
| `Tabla` | char(32) | NOT NULL | b'nombre de la tabla relacionada a la serie' | — |
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
