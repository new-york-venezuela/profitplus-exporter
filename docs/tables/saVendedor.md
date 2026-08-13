# Tabla: saVendedor
**Módulo**: Clientes
**Descripción de Negocio**: Maestro de vendedores y cobradores. Define el equipo comercial. `co_ven` aparece en `saFacturaVenta`, `saDocumentoVenta`, `saCobro` y `saCliente`. Los campos `fun_cob` y `fun_ven` indican si el vendedor también actúa como cobrador.

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_ven` | char | NOT NULL | Código del vendedor (PK) | Clave Primaria |
| `ven_des` | varchar | NULL | Nombre del vendedor | — |
| `tipo` | char | NULL | Tipo: `V`=vendedor, `C`=cobrador, `A`=ambos | — |
| `inactivo` | bit | NULL | `1` = vendedor inactivo | — |
| `cedula` | char | NULL | Cédula de identidad | — |
| `telefonos` | varchar | NULL | Teléfonos de contacto | — |
| `email` | varchar | NULL | Correo electrónico | — |
| `comision` | decimal | NULL | Porcentaje de comisión sobre ventas | — |
| `comisionv` | decimal | NULL | Porcentaje de comisión alternativa | — |
| `fun_cob` | bit | NULL | `1` = también actúa como cobrador | — |
| `fun_ven` | bit | NULL | `1` = actúa como vendedor | — |
| `co_zon` | char | NULL | Zona de ventas asignada | FK Implícita → `saZona.co_zon` |

## Recetario SQL de Negocio
```sql
-- Ventas por vendedor en el mes (en USD)
SELECT v.co_ven, v.ven_des,
       COUNT(DISTINCT f.doc_num) AS num_facturas,
       SUM(f.total_neto / NULLIF(f.tasa,0)) AS ventas_usd
FROM saVendedor v
LEFT JOIN saFacturaVenta f ON v.co_ven = f.co_ven
WHERE f.fec_emis BETWEEN '2024-01-01' AND '2024-01-31'
  AND f.anulado = 0 AND v.inactivo = 0
GROUP BY v.co_ven, v.ven_des
ORDER BY ventas_usd DESC;
```
