# Tabla: saDocumentoCompra
**Módulo**: Compras / Cuentas por Pagar
**Descripción de Negocio**: Libro mayor de cuentas por pagar. Espejo de `saDocumentoVenta` pero para el lado de compras. Registra facturas de proveedores (`FACT`), notas de crédito recibidas (`N/CR`), órdenes de pago y anticipos a proveedores. Es la fuente de verdad para saldo pendiente con proveedores.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_tipo_doc` | char | NOT NULL | Tipo de documento: `FACT`, `N/CR`, `N/DB`, `PAGO`, `ANT` | PK (con nro_doc) |
| `nro_doc` | char | NOT NULL | Número interno del documento | PK (con co_tipo_doc) |
| `nro_fact` | varchar | NULL | Número de factura del proveedor (externo) | — |
| `co_prov` | char | NULL | Código del proveedor | FK Implícita → `saProveedor.co_prov` |
| `co_mone` | char | NULL | Moneda del documento | FK Implícita → `saMoneda.co_mone` |
| `tasa` | decimal | NULL | Tasa de cambio al momento del registro | — |
| `fec_emis` | smalldatetime | NULL | Fecha de emisión del proveedor | — |
| `fec_venc` | smalldatetime | NULL | Fecha de vencimiento para pago | — |
| `total_neto` | decimal | NULL | Total del documento en Bs | — |
| `saldo` | decimal | NULL | Saldo pendiente de pago. `0` = pagado | — |
| `anulado` | bit | NULL | `1` = documento anulado | — |
| `aut` | bit | NULL | `1` = autorizado para pago | — |
| `pagar` | int | NULL | Indicador de política de pago | — |
| `monto_imp` | decimal | NULL | IVA del documento proveedor | — |
| `n_control` | varchar | NULL | Número de control del proveedor | — |
| `prov_ter` | char | NULL | `1` = proveedor tercero (no registrado) | — |
| `doc_orig` | char | NULL | Documento original al que aplica esta nota de crédito | — |
| `nro_orig` | varchar | NULL | Número del documento de origen | — |

## Triggers Relacionados
- `TrigEstado_saDocumentoCompra`: actualiza `saldo` cuando `saPagoDocReng` registra un pago

## Recetario SQL de Negocio
```sql
-- CXP pendiente neta por proveedor
SELECT
    d.co_prov,
    p.prov_des,
    SUM(CASE WHEN d.co_tipo_doc NOT IN ('N/CR','NCR')
             THEN d.saldo / NULLIF(d.tasa,0) ELSE 0 END) AS deuda_usd,
    SUM(CASE WHEN d.co_tipo_doc IN ('N/CR','NCR')
             THEN d.saldo / NULLIF(d.tasa,0) ELSE 0 END) AS creditos_proveedor_usd
FROM saDocumentoCompra d
LEFT JOIN saProveedor p ON d.co_prov = p.co_prov
WHERE d.anulado = 0 AND d.saldo <> 0
GROUP BY d.co_prov, p.prov_des
ORDER BY deuda_usd DESC;

-- Facturas de compra vencidas sin pagar
SELECT co_prov, nro_fact, nro_doc, fec_venc,
       saldo / NULLIF(tasa,0) AS saldo_usd,
       DATEDIFF(day, fec_venc, GETDATE()) AS dias_vencido
FROM saDocumentoCompra
WHERE anulado = 0 AND saldo > 0
  AND fec_venc < GETDATE()
  AND co_tipo_doc = 'FACT'
ORDER BY dias_vencido DESC;
```
