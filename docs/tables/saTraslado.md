# Tabla: saTraslado
**Módulo**: Logística
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `tras_num` | char(20) | NOT NULL | b'Codigo de Traslado' | — |
| `motivo_glo` | varchar(80) | NULL | b'Explicaci\xc3\xb3n o motivo de lo que causo el traslado' | — |
| `fecha` | smalldatetime(16,0) | NOT NULL | b'Fecha del Movimiento' | — |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `alm_orig` | char(6) | NOT NULL | b'Codigo del almacen origen' | FK → `saAlmacen.co_alma` |
| `alm_tmp` | char(6) | NOT NULL | b'Codigo del almacen temporal' | FK → `saAlmacen.co_alma` |
| `alm_dest` | char(6) | NULL | b'Codigo del almacen destino' | FK → `saAlmacen.co_alma` |
| `monto_dist` | decimal(18,2) | NULL | b'Monto Adicional a distribuir en los renglones (afecta costo)' | — |
| `confirma` | bit(1,0) | NOT NULL | b'Confirmacion del Traslado' | — |
| `fec_sal` | smalldatetime(16,0) | NOT NULL | b'Fecha en la que el inventario es descontado del origen y pasa al almacen temporal' | — |
| `fec_conf` | smalldatetime(16,0) | NULL | b'Fecha de la Confirmaci\xc3\xb3n' | — |
| `anulado` | bit(1,0) | NOT NULL | b'Indica si el registro7documento esta anulado' | — |
| `seriales_s` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
| `seriales_e` | int(10,0) | NULL | b'Reservado para futuras implementaciones' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
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
| `co_tran` | char(6) | NULL | — | FK → `saTransporte.co_tran` |
| `n_control` | varchar(20) | NULL | — | — |
| `impfis` | varchar(20) | NULL | — | — |
| `impfisfac` | varchar(15) | NULL | — | — |
| `imp_nro_z` | char(15) | NULL | b'Reservado para futuras imlpementaciones' | — |
| `impresa` | bit(1,0) | NOT NULL | — | — |
| `co_cond` | char(6) | NULL | b'c\xc3\xb3digo del conductor' | FK → `saTransporte.co_tran` |

## Triggers Relacionados
- `TrigEstado_saTraslado`

## Foreign Keys (explícitas)
- `fk_saTraslado_co_tran`: `co_tran` → `saTransporte.co_tran`
- `Fk_saTraslado_saTrCo_Cond`: `co_cond` → `saTransporte.co_tran`
- `FK_saTraslado_Alm_Dest`: `alm_dest` → `saAlmacen.co_alma`
- `FK_saTraslado_Alm_Orig`: `alm_orig` → `saAlmacen.co_alma`
- `FK_saTraslado_Alm_Temp`: `alm_tmp` → `saAlmacen.co_alma`
- `FK_saTraslado_saMoneda`: `co_mone` → `saMoneda.co_mone`
