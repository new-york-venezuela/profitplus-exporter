# Tabla: saDocumentoCompraInfoIGTF
**Módulo**: Compras
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid` | uniqueidentifier | NOT NULL | — | FK → `saDocumentoCompra.rowguid` |
| `base_imponible` | decimal(18,2) | NOT NULL | b'Base imponible sobre la que se aplica el impuesto' | — |
| `porc_aplic` | decimal(21,8) | NOT NULL | b'Valor en Porcentaje del Impuesto' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saDocumentoCompraInfoIGTF_saDocumentoCompra`: `rowguid` → `saDocumentoCompra.rowguid`
