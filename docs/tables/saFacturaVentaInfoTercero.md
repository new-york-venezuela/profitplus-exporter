# Tabla: saFacturaVentaInfoTercero
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid` | uniqueidentifier | NOT NULL | — | FK → `saFacturaVenta.rowguid` |
| `co_tercero` | char(16) | NOT NULL | — | FK → `saProveedor.co_prov` |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saFacturaVentaInfoTercero_saFacturaVenta`: `rowguid` → `saFacturaVenta.rowguid`
- `FK_saFacturaVentaInfoTercero_saProveedor`: `co_tercero` → `saProveedor.co_prov`
