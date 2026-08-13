# Tabla: saComisionPrecioLinea
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_comip` | char(6) | NOT NULL | b'Codigo de la comisision por nivel de precio' | — |
| `des_comip` | varchar(60) | NULL | b'Descripcion de la comisision por nivel de precio' | — |
| `co_lin` | char(6) | NOT NULL | b'Codigo de Linea' | FK → `saLineaArticulo.co_lin` |
| `co_precio` | char(6) | NULL | b'Codigo del tipo de precio' | FK → `saTipoPrecio.co_precio` |
| `tipo_ven` | char(1) | NOT NULL | b'Tipo de Vendedor. A: Tipo A, B: Tipo B, C: Tipo C, D: Tipo D, E: Tipo E, F: Tipo F, G: Tipo G, H: Tipo H, I: Tipo I, J: Tipo J (fijo = VTI)' | — |
| `aplica_en` | char(1) | NOT NULL | — | — |
| `hasta1` | decimal(18,2) | NOT NULL | b'Cantidad Vendida nivel 1' | — |
| `hasta2` | decimal(18,2) | NOT NULL | b'Cantidad Vendida nivel 2' | — |
| `hasta3` | decimal(18,2) | NOT NULL | b'Cantidad Vendida nivel 3' | — |
| `hasta4` | decimal(18,2) | NOT NULL | b'Cantidad Vendida nivel 4' | — |
| `hasta5` | decimal(18,2) | NOT NULL | b'Cantidad Vendida nivel 5' | — |
| `porc1` | decimal(18,2) | NOT NULL | b'Porcentaje de comision nivel 1' | — |
| `porc2` | decimal(18,2) | NOT NULL | b'Porcentaje de comision nivel 2' | — |
| `porc3` | decimal(18,2) | NOT NULL | b'Porcentaje de comision nivel 3' | — |
| `porc4` | decimal(18,2) | NOT NULL | b'Porcentaje de comision nivel 4' | — |
| `porc5` | decimal(18,2) | NOT NULL | b'Porcentaje de comision nivel 5' | — |
| `porc6` | decimal(18,2) | NOT NULL | b'Porcentaje de comision nivel 6' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saComisionPrecioLinea_saLineaArticulo`: `co_lin` → `saLineaArticulo.co_lin`
- `FK_saComisionPrecioLinea_saTipoPrecio`: `co_precio` → `saTipoPrecio.co_precio`
