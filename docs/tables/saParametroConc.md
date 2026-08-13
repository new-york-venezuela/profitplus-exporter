# Tabla: saParametroConc
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_conf` | char(6) | NOT NULL | b'codigo de configuracion de la cuenta bancaria' | — |
| `co_ban` | char(6) | NOT NULL | b'codigo del banco' | FK → `saBanco.co_ban` |
| `des_conf` | varchar(60) | NOT NULL | b'descripcion de la configuracion' | — |
| `opc_doc` | bit(1,0) | NOT NULL | b'indica si la conciliacion bancaria automatica va a tomar en consideracion el numero del documento' | — |
| `conc_parcial` | int(10,0) | NOT NULL | b'Tipo de coincidencia' | — |
| `cantidadDig` | int(10,0) | NOT NULL | b'cantidad de digitos a coincidir del codigo del movimiento' | — |
| `opc_fec` | bit(1,0) | NOT NULL | b'Indica si la conciliacion bancaria automatica va a tomar en consideracion la fecha de los movimiento' | — |
| `margenInf` | int(10,0) | NOT NULL | b'Indica el margen por debajo de la fecha del movimiento que se tomara en cuenta para la conciliacion' | — |
| `margenSup` | int(10,0) | NOT NULL | b'Indica el margen por encima de la fecha del movimiento que se tomara en cuenta para la conciliacion' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saParametroConc_saBanco`: `co_ban` → `saBanco.co_ban`
