# Tabla: saPagoDocReng
**Módulo**: Tesorería / Cuentas por Pagar
**Descripción de Negocio**: Renglones de documentos cancelados por cada pago. Espejo de `saCobroDocReng` para compras. Une `saPago` con las facturas de proveedor en `saDocumentoCompra` que se están pagando. Registra montos de retención IVA e ISLR aplicados en el pago.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `reng_num` | int | NOT NULL | Número de renglón | PK (con cob_num) |
| `cob_num` | char | NOT NULL | Número del pago | FK → `saPago.cob_num` |
| `co_tipo_doc` | char | NULL | Tipo del documento de compra cancelado | FK → `saDocumentoCompra.co_tipo_doc` |
| `nro_doc` | char | NULL | Número del documento cancelado | FK → `saDocumentoCompra.nro_doc` |
| `nro_fact` | varchar | NULL | Número de factura del proveedor del documento cancelado | — |
| `mont_cob` | decimal | NULL | Monto pagado contra este documento | — |
| `monto_retencion_iva` | decimal | NULL | Monto de retención IVA deducida al proveedor | — |
| `monto_retencion` | decimal | NULL | Monto de retención ISLR deducida | — |
| `dppago_porc_desc` | decimal | NULL | Porcentaje de descuento por pronto pago | — |
| `dppago_monto` | decimal | NULL | Monto del descuento por pronto pago | — |
| `rowguid` | uniqueidentifier | NULL | GUID usado como FK desde `saPagoRetenIvaReng` y `saPagoRentenReng` | — |
