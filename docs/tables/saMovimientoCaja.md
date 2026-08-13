# Tabla: saMovimientoCaja
**Módulo**: Tesorería
**Descripción de Negocio**: Libro de caja. Registra todos los ingresos y egresos de efectivo y formas de pago no bancarias (efectivo, tarjetas de crédito, vales). Cada movimiento tiene una `forma_pag` que puede ser efectivo, punto de venta, transferencia desde caja, etc. Relacionado con `saMovimientoBanco` cuando el efectivo se deposita al banco.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `mov_num` | char | NOT NULL | Número del movimiento de caja (PK) | Clave Primaria |
| `cod_caja` | char | NULL | Código de la caja | FK → `saCaja.co_caj` |
| `fecha` | smalldatetime | NULL | Fecha del movimiento | — |
| `tasa` | decimal | NULL | Tasa de cambio | — |
| `tipo_mov` | char | NULL | Tipo: `I`=ingreso, `E`=egreso | — |
| `forma_pag` | char | NULL | Forma de pago: `E`=efectivo, `T`=tarjeta, `C`=cheque, `V`=vale | — |
| `num_pago` | varchar | NULL | Número de referencia de la forma de pago | — |
| `monto_d` | decimal | NULL | Monto de débito (egreso) | — |
| `monto_h` | decimal | NULL | Monto haber (ingreso) | — |
| `co_ban` | char | NULL | Banco del pago con tarjeta/cheque | FK → `saBanco.co_ban` |
| `co_tar` | char | NULL | Tipo de tarjeta de crédito | FK → `saTarjetaCredito.co_tar` |
| `saldo_ini` | bit | NULL | `1` = saldo inicial de apertura de caja | — |
| `depositado` | bit | NULL | `1` = este movimiento ya fue depositado al banco | — |
| `transferido` | bit | NULL | `1` = transferido entre cajas | — |
| `anulado` | bit | NULL | `1` = movimiento anulado | — |
| `origen` | char | NULL | Origen: `C`=cobro, `P`=pago, `M`=manual | — |
| `doc_num` | varchar | NULL | Documento origen | — |

## Recetario SQL de Negocio
```sql
-- Flujo de caja del día por forma de pago
SELECT cod_caja, forma_pag,
       SUM(monto_h) AS ingresos, SUM(monto_d) AS egresos,
       SUM(monto_h) - SUM(monto_d) AS saldo_neto
FROM saMovimientoCaja
WHERE CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)
  AND anulado = 0 AND saldo_ini = 0
GROUP BY cod_caja, forma_pag;

-- Efectivo sin depositar al banco
SELECT mov_num, cod_caja, fecha, monto_h
FROM saMovimientoCaja
WHERE forma_pag = 'E' AND depositado = 0 AND anulado = 0
  AND tipo_mov = 'I'
ORDER BY fecha;
```
