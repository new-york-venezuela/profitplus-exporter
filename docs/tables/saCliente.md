# Tabla: saCliente
**Módulo**: Clientes
**Descripción de Negocio**: Maestro de clientes. Almacena datos de contacto, condiciones comerciales, crédito autorizado y configuración fiscal. El campo `contrib` es crítico: `1` indica contribuyente especial (retiene IVA al pagar). Todas las facturas de venta referencian esta tabla.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_cli` | char | NOT NULL | Código del cliente (PK) | Clave Primaria |
| `cli_des` | varchar | NULL | Nombre o razón social | — |
| `tip_cli` | char | NULL | Tipo de cliente | FK Implícita → `saTipoCliente` |
| `inactivo` | bit | NULL | `1` = cliente bloqueado/inactivo | — |
| `rif` | varchar | NULL | RIF fiscal venezolano (J-, V-, G-, E-) | — |
| `nit` | varchar | NULL | NIT o identificador fiscal alternativo | — |
| `contrib` | bit | NULL | **`1` = contribuyente especial** (SENIAT). Activa retención IVA automática en cobros | — |
| `mont_cre` | decimal | NULL | Límite de crédito autorizado en Bs | — |
| `co_mone` | char | NULL | Moneda del crédito | FK Implícita → `saMoneda.co_mone` |
| `cond_pag` | char | NULL | Condición de pago por defecto | FK → `saCondicionPago.co_cond` |
| `plaz_pag` | int | NULL | Plazo de pago en días | — |
| `desc_ppago` | decimal | NULL | Descuento por pronto pago (%) | — |
| `co_zon` | char | NULL | Zona de ventas | FK Implícita → `saZona.co_zon` |
| `co_seg` | char | NULL | Segmento de cliente | FK Implícita → `saSegmento.co_seg` |
| `co_ven` | char | NULL | Vendedor asignado por defecto | FK Implícita → `saVendedor.co_ven` |
| `desc_glob` | decimal | NULL | Descuento global default (%) | — |
| `direc1` | varchar | NULL | Dirección fiscal | — |
| `dir_ent2` | varchar | NULL | Dirección de entrega | — |
| `telefonos` | varchar | NULL | Teléfonos de contacto | — |
| `email` | varchar | NULL | Correo electrónico | — |
| `juridico` | bit | NULL | `1` = persona jurídica; `0` = persona natural | — |
| `tipo_per` | char | NULL | Tipo de persona para ISLR | — |
| `co_tab` | char | NULL | Tabulador ISLR asignado | FK → `saTabuladorIslr.co_tab` |
| `fecha_reg` | smalldatetime | NULL | Fecha de registro | — |
| `puntaje` | int | NULL | Puntos acumulados en programa de fidelidad | — |
| `co_cta_ingr_egr` | char | NULL | Cuenta contable de ingresos para integración | — |

## Recetario SQL de Negocio
```sql
-- Clientes contribuyentes especiales activos
SELECT co_cli, cli_des, rif, co_ven
FROM saCliente
WHERE contrib = 1 AND inactivo = 0
ORDER BY cli_des;

-- Clientes con deuda sobre su límite de crédito
SELECT c.co_cli, c.cli_des, c.mont_cre,
       SUM(d.saldo / NULLIF(d.tasa,0)) AS deuda_usd
FROM saCliente c
INNER JOIN saDocumentoVenta d ON c.co_cli = d.co_cli
WHERE d.anulado = 0 AND d.saldo > 0
  AND d.co_tipo_doc NOT IN ('N/CR','NCR')
GROUP BY c.co_cli, c.cli_des, c.mont_cre
HAVING SUM(d.saldo) > c.mont_cre
ORDER BY deuda_usd DESC;
```
