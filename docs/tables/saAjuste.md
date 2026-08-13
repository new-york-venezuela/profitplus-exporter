# Tabla: saAjuste
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `ajue_num` | char(20) | NOT NULL | b'N\xc3\xbamero de Ajuste' | — |
| `fecha` | smalldatetime(16,0) | NOT NULL | b'Fecha del Ajuste' | — |
| `motivo` | varchar(80) | NULL | b'Motivo del Ajuste' | — |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `seriales_s` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
| `seriales_e` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `anulado` | bit(1,0) | NOT NULL | b'Indica si el registro7documento esta anulado' | — |
| `co_invfisico` | char(20) | NULL | b'Codigo de Inventario Fisico' | FK → `saInventarioFisico.co_invfisico` |
| `aux01` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `aux02` | varchar(30) | NULL | b'Reservado para futuras implementaciones' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
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
- `TrigEstado_saAjuste`

## Foreign Keys (explícitas)
- `FK_saAjuste_saInventarioFisico`: `co_invfisico` → `saInventarioFisico.co_invfisico`
- `FK_saAjuste_saMoneda`: `co_mone` → `saMoneda.co_mone`
