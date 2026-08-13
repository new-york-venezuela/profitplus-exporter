# Tabla: saSaldoBanco
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_cta` | char(6) | NOT NULL | b'Codigo de la cuenta bancaria' | FK → `saCuentaBancaria.cod_cta` |
| `tipo` | char(2) | NOT NULL | b'TI = Total Disponible Inicial, CI = Conciliado Inicial, TF = Total Disponible, CF =Conciliado' | — |
| `saldo` | decimal(18,2) | NOT NULL | b'Monto del saldo del documento' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saSaldoBanco_saCuentaBancaria`: `cod_cta` → `saCuentaBancaria.cod_cta`
