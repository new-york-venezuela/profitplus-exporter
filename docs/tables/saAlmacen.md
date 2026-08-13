# Tabla: saAlmacen
**Módulo**: Inventario
**Descripción de Negocio**: Maestro de almacenes (bodegas). Define los depósitos físicos de inventario de la empresa. Los flags `nocompra` y `noventa` controlan si el almacén puede recibir compras o hacer salidas de venta. Un almacén de `produccion=1` es donde se procesan artículos compuestos (ensamble).

## Campos Clave
| Campo | Tipo | Nulo | Descripción de Negocio | Relación |
|---|---|---|---|---|
| `co_alma` | char | NOT NULL | Código del almacén (PK) | Clave Primaria |
| `des_alma` | varchar | NULL | Descripción del almacén | — |
| `co_sucur` | char | NULL | Sucursal a la que pertenece | FK → `saSucursal` |
| `noventa` | bit | NULL | `1` = no permite ventas desde este almacén | — |
| `nocompra` | bit | NULL | `1` = no permite compras a este almacén | — |
| `materiales` | bit | NULL | `1` = almacén de materiales/insumos (producción) | — |
| `produccion` | bit | NULL | `1` = almacén de producción/ensamble | — |
| `alm_temp` | bit | NULL | `1` = almacén temporal (tránsito) | — |
| `direccion` | varchar | NULL | Dirección física del almacén | — |
