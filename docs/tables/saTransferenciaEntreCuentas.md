# Tabla: saTransferenciaEntreCuentas
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_trans_ban` | char(20) | NOT NULL | b'C\xc3\xb3digo de la transferencia' | — |
| `des_trans_ban` | char(60) | NULL | b'Descripci\xc3\xb3n de la transferenca' | — |
| `fecha` | datetime(23,3) | NOT NULL | b'Fecha de la transferencia' | — |
| `procesado` | bit(1,0) | NOT NULL | b'Indica si la transferencia ya se proces\xc3\xb3' | — |
| `monto` | decimal(18,2) | NOT NULL | b'Monto' | — |
| `comision` | decimal(18,2) | NULL | b'Comisi\xc3\xb3n' | — |
| `cta_origen` | char(6) | NOT NULL | b'Cuenta de donde se debita' | FK → `saCuentaBancaria.cod_cta` |
| `cta_ingr_egr_origen` | char(20) | NOT NULL | b'Cuenta de ingreso-egreso de donde se debita' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `fecha_origen` | smalldatetime(16,0) | NOT NULL | b'Fecha en la cual se debita' | — |
| `mov_ban_origen` | char(20) | NULL | b'C\xc3\xb3digo del movimiento de banco del debito' | FK → `saMovimientoBanco.mov_num` |
| `referencia_origen` | char(60) | NULL | — | — |
| `cta_comision` | char(6) | NULL | b'Cuenta donde se cobrar\xc3\xa1 la comisi\xc3\xb3n' | FK → `saCuentaBancaria.cod_cta` |
| `cta_ingr_egr_comision` | char(20) | NULL | b'Cuenta de ingreso-egreso de donde se debita la comisi\xc3\xb3n' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `mov_ban_comision` | char(20) | NULL | b'C\xc3\xb3digo del movimiento de banco de la comisi\xc3\xb3n' | FK → `saMovimientoBanco.mov_num` |
| `cta_destino` | char(6) | NOT NULL | b'Cuenta donde se abona' | FK → `saCuentaBancaria.cod_cta` |
| `cta_ingr_egr_destino` | char(20) | NOT NULL | b'Cuenta de ingreso-egreso en la que se abona' | FK → `saCuentaIngEgr.co_cta_ingr_egr` |
| `fecha_destino` | smalldatetime(16,0) | NOT NULL | b'Fecha del abono' | — |
| `mov_ban_destino` | char(20) | NULL | b'C\xc3\xb3digo del movimiento de banco del abono' | FK → `saMovimientoBanco.mov_num` |
| `referencia_destino` | char(60) | NULL | — | — |
| `tasa_origen` | decimal(21,8) | NOT NULL | — | — |
| `campo1` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b' Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b' Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de inserci\xc3\xb3n del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que hizo la \xc3\xbaltima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue modificado por \xc3\xbaltima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador \xc3\xbanico' | — |
| `tasa` | decimal(21,8) | NOT NULL | — | — |
| `referencia_comis` | char(60) | NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saTransferenciaEntreBancos_cta_comision_saCuentaBancaria`: `cta_comision` → `saCuentaBancaria.cod_cta`
- `FK_saTransferenciaEntreBancos_cta_destino_saCuentaBancaria`: `cta_destino` → `saCuentaBancaria.cod_cta`
- `FK_saTransferenciaEntreBancos_cta_ingr_egr_comision_saCuentaIngEgr`: `cta_ingr_egr_comision` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_saTransferenciaEntreBancos_cta_ingr_egr_destino_saTransferenciaEntreBancos`: `cta_ingr_egr_destino` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_saTransferenciaEntreBancos_cta_ingr_egr_origen_saCuentaIngEgr`: `cta_ingr_egr_origen` → `saCuentaIngEgr.co_cta_ingr_egr`
- `FK_saTransferenciaEntreBancos_cta_origen_saCuentaBancaria`: `cta_origen` → `saCuentaBancaria.cod_cta`
- `FK_saTransferenciaEntreBancos_mov_ban_comision_saTransferenciaEntreBancos`: `mov_ban_comision` → `saMovimientoBanco.mov_num`
- `FK_saTransferenciaEntreBancos_mov_ban_destino_saTransferenciaEntreBancos`: `mov_ban_destino` → `saMovimientoBanco.mov_num`
- `FK_saTransferenciaEntreBancos_mov_ban_origen_saMovimientoBanco`: `mov_ban_origen` → `saMovimientoBanco.mov_num`
