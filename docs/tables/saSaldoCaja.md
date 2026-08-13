# Tabla: saSaldoCaja
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_caja` | char(6) | NOT NULL | — | FK → `saCaja.cod_caja` |
| `tipo` | char(2) | NOT NULL | — | — |
| `saldo` | decimal(18,2) | NOT NULL | b'Monto del saldo del documento' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saSaldoCaja_saCaja`: `cod_caja` → `saCaja.cod_caja`
