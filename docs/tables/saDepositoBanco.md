# Tabla: saDepositoBanco
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `dep_num` | char(20) | NOT NULL | b'N\xc3\xbamero del dep\xc3\xb3sito bancario' | — |
| `deposito` | char(20) | NOT NULL | b'N\xc3\xbamero de la Planilla del banco' | — |
| `fecha` | smalldatetime(16,0) | NOT NULL | b'Fecha del Movimiento' | — |
| `cod_cta` | char(6) | NOT NULL | b'Codigo de la cuenta bancaria' | FK → `saCuentaBancaria.cod_cta` |
| `cod_caja` | char(6) | NULL | b'C\xc3\xb3digo de la Caja del efectivo' | FK → `saCaja.cod_caja` |
| `mov_num_b` | char(20) | NULL | b'C\xc3\xb3digo de Movimiento creado en Banco' | — |
| `mov_num_c` | char(20) | NULL | b'C\xc3\xb3digo de Movimiento creado en caja asociado al efectivo depositado' | — |
| `total_efec` | decimal(18,2) | NOT NULL | b'Monto total en Efectivo' | — |
| `che_dev` | int(10,0) | NOT NULL | b'Marca que indica si este deposito posee un cheque devuelto.' | — |
| `co_cta_ingr_egr` | char(20) | NOT NULL | b'C\xc3\xb3digo de la cuenta de egreso' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `aux01` | decimal(18,5) | NULL | b'Reservado para futuras implementaciones' | — |
| `aux02` | varchar(30) | NULL | b'Reservado para futuras implementaciones' | — |
| `activado` | bit(1,0) | NOT NULL | b'Indica si el deposito esta procesado' | — |
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
- `TrigEstado_saDepositoBanco`

## Foreign Keys (explícitas)
- `FK_saDepositoBanco_saCaja`: `cod_caja` → `saCaja.cod_caja`
- `FK_saDepositoBanco_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
- `FK_saDepositoBanco_saCuentaIngEgr`: `co_cta_ingr_egr` → `saCuentaIngEgr.co_cta_ingr_egr`
