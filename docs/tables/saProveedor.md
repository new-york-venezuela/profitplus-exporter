# Tabla: saProveedor
**Módulo**: Clientes (Proveedores)
**Descripción de Negocio**: Maestro de proveedores. Almacena datos de contacto, condiciones de pago, crédito recibido y configuración fiscal. El campo `rete_regis_doc` activa la retención automática de IVA e ISLR al registrar documentos de compra. Complementado por `saProveedorExt` para campos adicionales.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_prov` | char | NOT NULL | Código del proveedor (PK) | Clave Primaria |
| `prov_des` | varchar | NULL | Nombre o razón social | — |
| `tip_pro` | char | NULL | Tipo de proveedor | FK Implícita → `saTipoProveedor` |
| `inactivo` | bit | NULL | `1` = proveedor inactivo | — |
| `rif` | varchar | NULL | RIF fiscal venezolano | — |
| `nit` | varchar | NULL | NIT o identificador alternativo | — |
| `nacional` | bit | NULL | `1` = proveedor nacional; `0` = importación | — |
| `mont_cre` | decimal | NULL | Crédito disponible del proveedor | — |
| `co_mone` | char | NULL | Moneda del crédito | FK Implícita → `saMoneda.co_mone` |
| `cond_pag` | char | NULL | Condición de pago | FK → `saCondicionPago.co_cond` |
| `plaz_pag` | int | NULL | Días de crédito | — |
| `desc_ppago` | decimal | NULL | Descuento por pronto pago (%) | — |
| `co_zon` | char | NULL | Zona | — |
| `co_seg` | char | NULL | Segmento | — |
| `co_pais` | char | NULL | País de origen | FK → `saPais.co_pais` |
| `rete_regis_doc` | bit | NULL | **`1` = aplicar retención IVA/ISLR automáticamente** al registrar facturas | — |
| `contribu_e` | bit | NULL | `1` = contribuyente especial | — |
| `porc_esp` | decimal | NULL | Porcentaje especial de retención IVA | — |
| `co_tab` | char | NULL | Tabulador ISLR del proveedor | FK → `saTabuladorIslr.co_tab` |
| `tipo_per` | char | NULL | Tipo de persona natural/jurídica para ISLR | — |
| `co_cta_ingr_egr` | char | NULL | Cuenta contable de gastos | — |
| `campo1`-`campo8` | varchar | NULL | Campos personalizables | — |

## Recetario SQL de Negocio
```sql
-- Proveedores con retención automática activa
SELECT co_prov, prov_des, rif, contribu_e, porc_esp
FROM saProveedor
WHERE rete_regis_doc = 1 AND inactivo = 0
ORDER BY prov_des;
```
