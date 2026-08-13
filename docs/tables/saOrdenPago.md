# Tabla: saOrdenPago
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `ord_num` | char(20) | NOT NULL | b'N\xc3\xbamero Correlativo para las ordenes de pago' | — |
| `status` | char(1) | NOT NULL | b'0: no procesada, 1: parcialmente procesada: 2: procesada totalmente' | — |
| `fecha` | smalldatetime(16,0) | NOT NULL | b'Fecha del Movimiento' | — |
| `cod_ben` | char(10) | NOT NULL | b'C\xc3\xb3digo del beneficiario relacionado' | FK → `saBeneficiario.cod_ben` |
| `descrip` | varchar(max) | NULL | b'Descripci\xc3\xb3n del registro o documento' | — |
| `forma_pag` | char(2) | NOT NULL | b'Forma de pago (Cheque,CH,Efectivo,EF,Transferencia,TR)' | — |
| `fec_pag` | smalldatetime(16,0) | NOT NULL | b'Fecha de Pago.' | — |
| `cod_cta` | char(6) | NULL | b'Codigo de la cuenta bancaria' | FK → `saCuentaBancaria.cod_cta` |
| `doc_num` | char(20) | NULL | b'Numero de documento' | — |
| `cod_caja` | char(6) | NULL | b'C\xc3\xb3digo de la Caja' | FK → `saCaja.cod_caja` |
| `mov_num_c` | char(20) | NULL | b'N\xc3\xbamero del movimiento de banco creado' | FK → `saMovimientoCaja.mov_num` |
| `mov_num_b` | char(20) | NULL | — | FK → `saMovimientoBanco.mov_num` |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `tasa` | decimal(21,8) | NOT NULL | b'tasa de conversion de la moneda del documento con respecto a la moneda base' | — |
| `co_mone` | char(6) | NOT NULL | b'Codigo de la moneda' | FK → `saMoneda.co_mone` |
| `anulado` | bit(1,0) | NOT NULL | b'Indica si el registro7documento esta anulado' | — |
| `sino_reten` | bit(1,0) | NOT NULL | b'Determina si tiene se ha aplicado retencion o no a la orden de pago' | — |
| `pagar` | int(10,0) | NOT NULL | b'*' | — |
| `origen` | char(3) | NULL | b'Indica cual es el origen del documento. Ej: M=Profit M\xc3\xb3vil, E= eProfit' | — |
| `origen_d` | char(20) | NULL | b'Indica el N\xc3\xbamero del documento origen registrado en el campo ORIGEN.' | — |
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
- `TrigEstado_saOrdenPago`

## Foreign Keys (explícitas)
- `FK_saOrdenPago_saBeneficiario`: `cod_ben` → `saBeneficiario.cod_ben`
- `FK_saOrdenPago_saCaja`: `cod_caja` → `saCaja.cod_caja`
- `FK_saOrdenPago_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
- `FK_saOrdenPago_saMoneda`: `co_mone` → `saMoneda.co_mone`
- `FK_saOrdenPago_saMovimientoBanco`: `mov_num_b` → `saMovimientoBanco.mov_num`
- `FK_saOrdenPago_saMovimientoCaja`: `mov_num_c` → `saMovimientoCaja.mov_num`
