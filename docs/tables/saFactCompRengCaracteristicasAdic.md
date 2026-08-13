# Tabla: saFactCompRengCaracteristicasAdic
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `doc_orig` | uniqueidentifier | NOT NULL | — | FK → `saFacturaCompraReng.rowguid` |
| `volumen_neto` | decimal(18,5) | NOT NULL | — | — |
| `peso_neto` | decimal(18,5) | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saFactCompRengCaracteristicasAdic_saFactCompRengCaracteristicasAdic`: `doc_orig` → `saFactCompRengCaracteristicasAdic.doc_orig`
- `FK_saFactCompRengCaracteristicasAdic_saFacturaCompraReng`: `doc_orig` → `saFacturaCompraReng.rowguid`
