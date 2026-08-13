# Tabla: saMovimientoBanco
**Módulo**: Tesorería
**Descripción de Negocio**: Libro de banco. Registra todos los movimientos (débitos y créditos) de cada cuenta bancaria. Es la base para la conciliación bancaria. Cada movimiento tiene un tipo de operación (`tipo_op`) que define si es depósito, cheque, transferencia, pago de nómina, etc. La columna `conciliado` indica si el movimiento fue verificado contra el estado de cuenta bancario.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `mov_num` | char | NOT NULL | Número del movimiento (PK) | Clave Primaria |
| `cod_cta` | char | NULL | Código de cuenta bancaria | FK → `saCuentaBancaria.cod_cta` |
| `co_cta_ingr_egr` | char | NULL | Cuenta de ingresos/egresos para contabilidad | FK → `saCuentaIngEgr` |
| `fecha` | smalldatetime | NULL | Fecha del movimiento | — |
| `tasa` | decimal | NULL | Tasa de cambio al momento del movimiento | — |
| `tipo_op` | char | NULL | Tipo de operación: `D`=depósito, `C`=cheque, `T`=transferencia, `N`=nómina, `P`=pago, `O`=otro | — |
| `doc_num` | varchar | NULL | Número del documento origen (cobro, pago, etc.) | — |
| `monto_d` | decimal | NULL | Monto del débito (egreso del banco) | — |
| `monto_h` | decimal | NULL | Monto del haber/crédito (ingreso al banco) | — |
| `idb` | decimal | NULL | Impuesto a los Débitos Bancarios (IGTF, IDB) si aplica | — |
| `saldo_ini` | bit | NULL | `1` = fila de saldo inicial de apertura | — |
| `origen` | char | NULL | Sistema de origen: `C`=cobro, `P`=pago, `D`=depósito, `M`=manual | — |
| `cob_pag` | char | NULL | Número del cobro/pago que generó este movimiento | — |
| `dep_num` | char | NULL | Número del depósito si aplica | — |
| `conciliado` | bit | NULL | `1` = movimiento conciliado con estado de cuenta bancario | — |
| `ori_dep` | bit | NULL | `1` = movimiento generado desde un depósito | — |
| `anulado` | bit | NULL | `1` = movimiento anulado | — |
| `cod_ingben` | char | NULL | Código del beneficiario del ingreso | — |
| `fecha_che` | smalldatetime | NULL | Fecha del cheque (puede diferir de fecha de registro) | — |

## Recetario SQL de Negocio
```sql
-- Saldo actual por cuenta bancaria
SELECT cod_cta, cb.des_cta,
       SUM(monto_h) - SUM(monto_d) AS saldo_bs
FROM saMovimientoBanco mb
LEFT JOIN saCuentaBancaria cb ON mb.cod_cta = cb.cod_cta
WHERE mb.anulado = 0
GROUP BY mb.cod_cta, cb.des_cta;

-- Movimientos sin conciliar por cuenta
SELECT mov_num, cod_cta, fecha, tipo_op, doc_num,
       monto_d, monto_h
FROM saMovimientoBanco
WHERE conciliado = 0 AND anulado = 0 AND saldo_ini = 0
ORDER BY cod_cta, fecha;
```
