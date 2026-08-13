# Tabla: pvRenglonTicket
**Módulo**: Punto de Venta
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cob_num` | char(20) | NOT NULL | b'Identificador del cobro (Tabla saCobro)' | FK → `saCobroTPReng.cob_num` |
| `reng_num` | int(10,0) | NOT NULL | b'N\xc3\xbamero de rengl\xc3\xb3n del cobro asociado' | FK → `saCobroTPReng.reng_num` |
| `reng_num_vale` | int(10,0) | NOT NULL | b'Rengl\xc3\xb3n del tipo de cestaticket (Tabla pvValeAlimentacionReng)' | FK → `pvValeAlimentacionReng.reng_num` |
| `co_vale` | char(6) | NOT NULL | b'Identificador de Cestaticket (Tabla pvValeAlimentacionReng)' | FK → `pvValeAlimentacionReng.co_vale` |
| `cantidad` | int(10,0) | NOT NULL | b'Cantidad de cestatickets' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NULL | b'C\xc3\xb3digo del usuario que ingres\xc3\xb3 el registro' | — |
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
- `FK_pvRenglonTicket_pvValeAlimentacionReng`: `reng_num_vale` → `pvValeAlimentacionReng.reng_num`
- `FK_pvRenglonTicket_pvValeAlimentacionReng`: `co_vale` → `pvValeAlimentacionReng.co_vale`
- `FK_pvRenglonTicket_saCobroTPReng`: `reng_num` → `saCobroTPReng.reng_num`
- `FK_pvRenglonTicket_saCobroTPReng`: `cob_num` → `saCobroTPReng.cob_num`
