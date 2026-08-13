# Tabla: saCheque
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_cheq` | char(20) | NOT NULL | b'Codigo del cheque' | — |
| `co_chra` | char(6) | NOT NULL | b'Codigo de la chequera' | FK → `saChequera.co_chra` |
| `mov_num` | char(20) | NULL | b'Codigo de movimiento de banco' | FK → `saMovimientoBanco.mov_num` |
| `Status` | char(3) | NOT NULL | b"Estado del cheque. 'DIS'=Disponible; 'EMI'=Emitido; 'ANU'=Anulado;" | — |
| `descrip` | varchar(60) | NULL | b'descripcion' | — |
| `fec_emis` | smalldatetime(16,0) | NULL | b'Fecha de emision' | — |
| `fec_ent` | smalldatetime(16,0) | NULL | b'Fecha de entrega' | — |
| `entreg_a` | varchar(60) | NULL | b'Indica a quien fue entregado' | — |
| `comentario` | varchar(max) | NULL | b'Comentario' | — |
| `co_us_In` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saCheque_saChequera`: `co_chra` → `saChequera.co_chra`
- `FK_saCheque_saMovimientoBanco`: `mov_num` → `saMovimientoBanco.mov_num`
