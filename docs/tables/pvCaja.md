# Tabla: pvCaja
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_caja` | char(6) | NOT NULL | b'C\xc3\xb3digo de la Caja' | FK → `saCaja.cod_caja` |
| `mvisa` | bit(1,0) | NOT NULL | — | — |
| `vpostipo` | int(10,0) | NULL | b'Tipo de VPos (Megasoft, Creditcard, Novared)' | — |
| `puerto` | char(5) | NULL | b'Puerto para impresora' | — |
| `puerto2` | char(5) | NULL | b'Puerto para display' | — |
| `sidisplay` | bit(1,0) | NOT NULL | b'Existe display' | — |
| `gavetaser` | bit(1,0) | NOT NULL | b'Existe gaveta' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que ingres\xc3\xb3 el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de inserci\xc3\xb3n del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que hizo la \xc3\xbaltima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue modificado por \xc3\xbaltima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la \xc3\xbaltima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saCaja_pvCaja`: `cod_caja` → `saCaja.cod_caja`
