# Tabla: saDocumentoVenta
**Módulo**: Ventas / Cuentas por Cobrar
**Descripción de Negocio**: Libro mayor de documentos de venta (cuentas por cobrar). Registra TODOS los documentos que afectan el saldo de un cliente: facturas (`FACT`), notas de crédito (`N/CR`, `NCR`), notas de débito (`N/DB`), anticipos y recibos de cobro. Es la fuente de verdad para saldo pendiente por cliente. No reemplaza a `saFacturaVenta`; la complementa con la visión de CXC.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_tipo_doc` | char | NOT NULL | Tipo de documento: `FACT`, `N/CR`, `N/DB`, `COBR`, `ANT` | PK (con nro_doc) |
| `nro_doc` | char | NOT NULL | Número de documento | PK (con co_tipo_doc) |
| `co_cli` | char | NULL | Código del cliente | FK Implícita → `saCliente.co_cli` |
| `co_ven` | char | NULL | Vendedor asignado | FK Implícita → `saVendedor.co_ven` |
| `co_mone` | char | NULL | Moneda del documento | FK Implícita → `saMoneda.co_mone` |
| `tasa` | decimal | NULL | Tasa de cambio al momento del documento | — |
| `fec_emis` | smalldatetime | NULL | Fecha de emisión | — |
| `fec_venc` | smalldatetime | NULL | Fecha de vencimiento | — |
| `fec_reg` | smalldatetime | NULL | Fecha de registro | — |
| `total_neto` | decimal | NULL | Monto total del documento en Bs | — |
| `saldo` | decimal | NULL | **Saldo pendiente en Bs**. `saldo=0` significa documento liquidado. Para N/CR con saldo>0, son créditos sin aplicar | — |
| `anulado` | bit | NULL | `1` = documento anulado; ignorar en reportes | — |
| `aut` | bit | NULL | `1` = documento autorizado para cobro | — |
| `doc_orig` | char | NULL | Documento original al que aplica (para N/CR que afecta una factura) | — |
| `tipo_origen` | int | NULL | Tipo del documento de origen | — |
| `nro_orig` | varchar | NULL | Número del documento de origen (ej: factura afectada por la nota de crédito) | — |
| `monto_imp` | decimal | NULL | Monto IVA del documento | — |
| `n_control` | varchar | NULL | Número de control fiscal (SENIAT) | — |
| `contrib` | bit | NULL | `1` = contribuyente especial | — |
| `mov_ban` | char | NULL | Código banco si el cobro generó movimiento bancario | FK → `saBanco` |
| `nro_che` | varchar | NULL | Número de cheque si aplica | — |
| `comis1`-`comis6` | decimal | NULL | Comisiones calculadas para el vendedor por tramo | — |

## Triggers Relacionados
- `TrigEstado_saDocumentoVenta`: actualiza `saldo` cuando se registra un cobro parcial o total en `saCobroDocReng`

## Relaciones Clave
- **Cobros**: `saCobroDocReng` (JOIN por `co_tipo_doc` + `nro_doc`) — cada renglón de cobro reduce el `saldo`
- **Facturas**: `saFacturaVenta` (mismo `nro_doc` cuando `co_tipo_doc = 'FACT'`)
- **Retenciones IVA**: `saCobroRetenIvaReng` a través del cobro

## Recetario SQL de Negocio
```sql
-- CXC pendiente neta por cliente (descontando notas de crédito sin aplicar)
SELECT
    d.co_cli,
    c.cli_des,
    SUM(CASE WHEN d.co_tipo_doc NOT IN ('N/CR','NCR')
             THEN d.saldo / NULLIF(d.tasa,0) ELSE 0 END)   AS deuda_usd,
    SUM(CASE WHEN d.co_tipo_doc IN ('N/CR','NCR')
             THEN d.saldo / NULLIF(d.tasa,0) ELSE 0 END)   AS creditos_sin_aplicar_usd,
    SUM(CASE WHEN d.co_tipo_doc NOT IN ('N/CR','NCR')
             THEN d.saldo / NULLIF(d.tasa,0) ELSE 0 END)
    - SUM(CASE WHEN d.co_tipo_doc IN ('N/CR','NCR')
               THEN d.saldo / NULLIF(d.tasa,0) ELSE 0 END) AS saldo_neto_real_usd
FROM saDocumentoVenta d
LEFT JOIN saCliente c ON d.co_cli = c.co_cli
WHERE d.anulado = 0 AND d.saldo <> 0
GROUP BY d.co_cli, c.cli_des
ORDER BY saldo_neto_real_usd DESC;

-- Documentos vencidos (morosos) por cliente
SELECT co_cli, co_tipo_doc, nro_doc, fec_venc,
       saldo, saldo / NULLIF(tasa,0) AS saldo_usd,
       DATEDIFF(day, fec_venc, GETDATE()) AS dias_vencido
FROM saDocumentoVenta
WHERE anulado = 0 AND saldo > 0
  AND fec_venc < GETDATE()
  AND co_tipo_doc NOT IN ('N/CR','NCR')
ORDER BY co_cli, dias_vencido DESC;
```
