# Tabla: saArtUnidad
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `co_uni` | char(6) | NOT NULL | b'Codigo de la unidad' | FK → `saUnidad.co_uni` |
| `relacion` | bit(1,0) | NOT NULL | b'True: relacion directa entre base y alterna, False: la relacion de quivalencia es inversa (divide)' | — |
| `equivalencia` | decimal(18,5) | NOT NULL | b'factor de equivalencia entre unidad alterna y base' | — |
| `uso_venta` | bit(1,0) | NOT NULL | b'Unidad empleada en venta' | — |
| `uso_compra` | bit(1,0) | NOT NULL | b'Unidad empleada en compra' | — |
| `uni_principal` | bit(1,0) | NOT NULL | b'Unidad principal base' | — |
| `uso_principal` | bit(1,0) | NOT NULL | b'Unidad principal alterna' | — |
| `uni_secundaria` | bit(1,0) | NOT NULL | b'Unidad secundaria base' | — |
| `uso_secundaria` | bit(1,0) | NOT NULL | b'Unidad secundaria alterna' | — |
| `uso_numDecimales` | bit(1,0) | NOT NULL | — | — |
| `num_decimales` | int(10,0) | NOT NULL | — | — |
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
- `TrigIU_saArtUnidad`

## Foreign Keys (explícitas)
- `FK_saArtUnidad_saArticulo`: `co_art` → `saArticulo.co_art`
- `FK_saArtUnidad_saUnidad`: `co_uni` → `saUnidad.co_uni`
