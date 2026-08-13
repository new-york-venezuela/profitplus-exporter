# Tabla: saDistribCostoOrigenReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `distrib_num` | char(20) | NOT NULL | b'Codigo de la distribucion de costos' | FK → `saDistribCosto.distrib_num` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de renglon' | — |
| `rowguid_comp` | uniqueidentifier | NULL | b'Rowguid del renglon de Factura de Compra origen' | FK → `saFacturaCompraReng.rowguid` |
| `rowguid_pcom` | uniqueidentifier | NULL | b'Rowguid del renglon de Plantilla de Compra origen' | FK → `saPlantillaCompraReng.rowguid` |
| `monto_ap` | decimal(18,5) | NULL | — | — |
| `co_incoterm` | char(6) | NULL | — | FK → `saIncoterm.co_incoterm` |
| `co_us_in` | char(6) | NOT NULL | — | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | — | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | — | — |
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `rowguid_calculado` | uniqueidentifier | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saDistribCostoOrigenReng_saDistribCosto`: `distrib_num` → `saDistribCosto.distrib_num`
- `FK_saDistribCostoOrigenReng_saFacturaCompraReng`: `rowguid_comp` → `saFacturaCompraReng.rowguid`
- `FK_saDistribCostoOrigenReng_saIncoterm`: `co_incoterm` → `saIncoterm.co_incoterm`
- `FK_saDistribCostoOrigenReng_saPlantillaCompraReng`: `rowguid_pcom` → `saPlantillaCompraReng.rowguid`
