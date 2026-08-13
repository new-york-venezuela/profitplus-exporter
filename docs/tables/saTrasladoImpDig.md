# Tabla: saTrasladoImpDig
**Módulo**: Logística
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `id` | uniqueidentifier | NOT NULL | — | — |
| `idOrig` | uniqueidentifier | NULL | — | — |
| `operacion` | varchar(16) | NOT NULL | — | — |
| `imprentName` | varchar(16) | NOT NULL | — | — |
| `status` | varchar(16) | NULL | — | — |
| `fechaRequest` | datetime(23,3) | NOT NULL | — | — |
| `request` | nvarchar(max) | NULL | — | — |
| `fechaResponse` | datetime(23,3) | NULL | — | — |
| `response` | nvarchar(max) | NULL | — | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | — | — |

## Triggers Relacionados
_Ninguno_
