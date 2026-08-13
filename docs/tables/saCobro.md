# Tabla: saCobro
**Módulo**: Tesorería / Cuentas por Cobrar
**Descripción de Negocio**: Encabezado de recibos de cobro (cobranzas). Cada fila es un recibo que registra el ingreso de dinero de un cliente. El cobro puede cancelar una o múltiples facturas (ver `saCobroDocReng`) y puede llevar retenciones IVA e ISLR (ver `saCobroRetenIvaReng`, `saCobroRentenReng`).

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `cob_num` | char | NOT NULL | Número del recibo de cobro (PK) | Clave Primaria |
| `recibo` | char | NULL | Número de recibo físico impreso | — |
| `co_cli` | char | NULL | Cliente que paga | FK Implícita → `saCliente.co_cli` |
| `co_ven` | char | NULL | Vendedor/cobrador | FK Implícita → `saVendedor.co_ven` |
| `co_mone` | char | NULL | Moneda del cobro | FK Implícita → `saMoneda.co_mone` |
| `tasa` | decimal | NULL | Tasa de cambio al momento del cobro | — |
| `fecha` | smalldatetime | NULL | Fecha del cobro | — |
| `monto` | decimal | NULL | Monto total cobrado en Bs (suma de todos los renglones `saCobroDocReng.mont_cob`) | — |
| `anulado` | bit | NULL | `1` = cobro anulado; los saldos de facturas se restauran | — |
| `descrip` | varchar | NULL | Descripción o concepto del cobro | — |

## Triggers Relacionados
_Ninguno_ (la actualización de saldos la maneja el SP de inserción de cobro)

## Relaciones Clave
- **Documentos cancelados**: `saCobroDocReng` (JOIN por `cob_num`) — lista de facturas/N/CR que cancela este cobro
- **Retención IVA**: `saCobroRetenIvaReng` ligado vía `saCobroDocReng.rowguid`
- **Retención ISLR**: `saCobroRentenReng` ligado vía `saCobroDocReng.rowguid`
- **Movimiento caja/banco**: `saMovimientoCaja` y `saMovimientoBanco` (doc_num = cob_num)

## Recetario SQL de Negocio
```sql
-- Cobros del mes con detalle de facturas canceladas
SELECT
    c.cob_num, c.fecha, c.co_cli, cl.cli_des,
    c.monto AS monto_cobrado_bs,
    c.monto / NULLIF(c.tasa,0) AS monto_cobrado_usd,
    r.co_tipo_doc, r.nro_doc, r.mont_cob
FROM saCobro c
INNER JOIN saCobroDocReng r  ON c.cob_num = r.cob_num
LEFT JOIN  saCliente cl      ON c.co_cli  = cl.co_cli
WHERE c.fecha BETWEEN '2024-01-01' AND '2024-01-31'
  AND c.anulado = 0
ORDER BY c.fecha, c.cob_num;

-- Total cobrado por cliente en el mes
SELECT c.co_cli, cl.cli_des,
       COUNT(*)              AS num_cobros,
       SUM(c.monto)          AS total_bs,
       SUM(c.monto / NULLIF(c.tasa,0)) AS total_usd
FROM saCobro c
LEFT JOIN saCliente cl ON c.co_cli = cl.co_cli
WHERE c.fecha BETWEEN '2024-01-01' AND '2024-01-31'
  AND c.anulado = 0
GROUP BY c.co_cli, cl.cli_des
ORDER BY total_usd DESC;
```
