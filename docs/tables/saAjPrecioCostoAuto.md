# Tabla: saAjPrecioCostoAuto
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_ajuste` | char(20) | NOT NULL | b'Codigo del ajuste de precio/costo' | — |
| `des_ajuste` | varchar(60) | NULL | b'Descripcion del ajuste de precio/costo' | — |
| `co_alma` | char(6) | NULL | b'Codigo del almacen' | FK Implícita → `saAlmacen.co_alma` |
| `tipo_ajuste` | int(10,0) | NOT NULL | b'Tipo de Ajuste 0: Precio, 1: Costo' | — |
| `tipo_ajuste_precio` | char(6) | NULL | — | — |
| `tipo_ajuste_costo` | char(6) | NULL | — | — |
| `metodo` | int(10,0) | NULL | b'1: incremento, 2: disminucion, 3: reemplazo' | — |
| `tipo_calculo` | int(10,0) | NULL | b'1: Monto, 2: Porcentaje, 3: Margen ganancia min, 4: Margen ganancia max' | — |
| `valor` | decimal(18,5) | NOT NULL | — | — |
| `factor` | decimal(18,5) | NOT NULL | — | — |
| `redondeo` | bit(1,0) | NOT NULL | — | — |
| `tipo_redondeo` | int(10,0) | NULL | b'1: Equitativo, 2: Superior, 3: Inferior' | — |
| `valor_redondeo` | char(4) | NULL | — | — |
| `margen_superior` | char(6) | NULL | b'1: Tomar el margen de ganancia m\xc3\xa1ximo, 2: No tomar en cuenta el m\xc3\xa1ximo de ganancia, 3: No realizar ajuste' | — |
| `margen_inferior` | char(6) | NULL | b'1: Tomar el margen de ganancia m\xc3\xadnimo, 2: No tomar en cuenta el m\xc3\xadnimo de ganancia, 3: No realizar ajuste' | — |
| `condicion1` | char(4) | NULL | — | — |
| `condicion2` | char(4) | NULL | — | — |
| `valor_condicion1` | decimal(18,5) | NULL | — | — |
| `operador_logico` | int(10,0) | NULL | b'1: Y, 0: O' | — |
| `valor_condicion2` | decimal(18,5) | NULL | — | — |
| `co_art_desde` | char(30) | NULL | — | — |
| `co_art_hasta` | char(30) | NULL | — | — |
| `co_lin_desde` | char(6) | NULL | — | — |
| `co_lin_hasta` | char(6) | NULL | — | — |
| `co_subl_desde` | char(6) | NULL | — | — |
| `co_subl_hasta` | char(6) | NULL | — | — |
| `co_cat_desde` | char(6) | NULL | — | — |
| `co_cat_hasta` | char(6) | NULL | — | — |
| `co_prov_desde` | char(16) | NULL | — | — |
| `co_prov_hasta` | char(16) | NULL | — | — |
| `item_desde` | char(10) | NULL | — | — |
| `item_hasta` | char(10) | NULL | — | — |
| `vigencia_desde` | datetime(23,3) | NULL | — | — |
| `vigencia_hasta` | datetime(23,3) | NULL | — | — |
| `basado_en` | bit(1,0) | NOT NULL | b'Indica si se actualizan los precios del art\xc3\xadculo o rango de art\xc3\xadculos tomando como base un tipo de costo en espec\xc3\xadfico a determinada fecha y/o en un almac\xc3\xa9n en particular.' | — |
| `basado_en_costo` | char(4) | NULL | b'Tipo de costo en el cual se basa el ajuste del precio' | — |
| `basado_en_fecha` | datetime(23,3) | NULL | b'Fecha a la cual se realizar\xc3\xa1 el c\xc3\xa1lculo de costo del art\xc3\xadculo o rango de art\xc3\xadculos' | — |
| `basado_en_co_alma` | char(6) | NULL | b'Almac\xc3\xa9n a considerar para el c\xc3\xa1lculo del costo del art\xc3\xadculo o rando de art\xc3\xadculos' | FK → `saAlmacen.co_alma` |
| `procesado` | bit(1,0) | NOT NULL | — | — |
| `fecha` | datetime(23,3) | NULL | — | — |
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
| `co_mone` | char(6) | NULL | — | FK → `saMoneda.co_mone` |
| `tasa` | decimal(21,8) | NULL | — | — |

## Triggers Relacionados
- `TrigEstado_saAjPrecioCostoAuto`

## Foreign Keys (explícitas)
- `FK_saAjPrecioCostoAuto_saMoneda`: `co_mone` → `saMoneda.co_mone`
- `FK_saAjPrecioCostoAuto_saAlmacen`: `basado_en_co_alma` → `saAlmacen.co_alma`
