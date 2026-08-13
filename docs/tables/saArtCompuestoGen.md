# Tabla: saArtCompuestoGen
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `gene_num` | char(20) | NOT NULL | b'N\xc3\xbamero de la Generaci\xc3\xb3n' | — |
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArtUnidad.co_art` |
| `co_alma` | char(6) | NOT NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |
| `co_uni` | char(6) | NOT NULL | b'Codigo de la unidad' | FK → `saArtUnidad.co_uni` |
| `fecha` | smalldatetime(16,0) | NOT NULL | b'Fecha del Movimiento' | — |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `total_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `stotal_art` | decimal(18,5) | NOT NULL | b'Total art\xc3\xadculos (en unidad secundaria) del documento en encabezados o total de art\xc3\xadculos comprados o vendidos en renglones' | — |
| `costo_tot` | decimal(18,5) | NOT NULL | b'Costo total de la operaci\xc3\xb3n' | — |
| `gene_art` | bit(1,0) | NOT NULL | b'Indica si el articulo generico fue generado' | — |
| `seriales_s` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
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
| `sco_uni` | char(6) | NULL | b'Codigo de la unidad secundaria' | — |

## Triggers Relacionados
- `TrigEstado_saArtCompuestoGen`

## Foreign Keys (explícitas)
- `FK_saArtCompuestoGen_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saArtCompuestoGen_saArtCompuesto`: `co_art` → `saArtCompuesto.co_art`
- `FK_saArtCompuestoGen_saArtUnidad`: `co_art` → `saArtUnidad.co_art`
- `FK_saArtCompuestoGen_saArtUnidad`: `co_uni` → `saArtUnidad.co_uni`
- `FK_saArtCompuestoGen_saMoneda`: `co_mone` → `saMoneda.co_mone`
