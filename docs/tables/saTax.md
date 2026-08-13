# Tabla: saTax
**Módulo**: Fiscal
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `tax_id` | char(8) | NOT NULL | b'C\xc3\xb3digo identificador del impuesto del condado o estado' | — |
| `tax_des` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n de la tasa de impuesto' | — |
| `entidad` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n de la entidad a la cual se paga ese impuesto' | — |
| `tasa1` | decimal(21,8) | NOT NULL | b'Corresponde al porcentaje que se asignar\xc3\xa1 para la tasa 1 del impuesto dentro del grupo que se est\xc3\xa1 agregando' | — |
| `tasa2` | decimal(21,8) | NOT NULL | b'Corresponde al porcentaje que se asignar\xc3\xa1 para la tasa 2 del impuesto dentro del grupo que se est\xc3\xa1 agregando' | — |
| `tasa3` | decimal(21,8) | NOT NULL | b'Corresponde al porcentaje que se asignar\xc3\xa1 para la tasa 3 del impuesto dentro del grupo que se est\xc3\xa1 agregando' | — |
| `formula` | bit(1,0) | NOT NULL | b'Campo que indica si el c\xc3\xa1lculo de ese impuesto se realizar\xc3\xa1 por f\xc3\xb3rmula o no. Si es verdadero indica que el c\xc3\xa1lculo se realizar\xc3\xa1 por f\xc3\xb3rmula, en caso contrario el c\xc3\xa1lculo ser\xc3\xa1 simple (se aplicar\xc3\xa1 una de las tres tasas disponibles)' | — |
| `limite` | decimal(18,5) | NOT NULL | b'Este campo aplica en el caso de que se haya activado el campo f\xc3\xb3rmula e indica el l\xc3\xadmite que se considerar\xc3\xa1 para el c\xc3\xa1lculo de impuesto por f\xc3\xb3rmula' | — |
| `porc1` | decimal(18,5) | NOT NULL | b'Este campo aplica en el caso de que se haya activado el campo f\xc3\xb3rmula e indica el porcentaje que se aplicar\xc3\xa1 si el monto base para el c\xc3\xa1lculo es igual o inferior al campo l\xc3\xadmite' | — |
| `porc2` | decimal(18,5) | NOT NULL | b'Este campo aplica en el caso de que se haya activado el campo f\xc3\xb3rmula e indica el porcentaje que se aplicar\xc3\xa1 si el monto base para el c\xc3\xa1lculo es igual o inferior al campo l\xc3\xadmite' | — |
| `dis_cen` | xml | NULL | b'Informacion Contable: cuenta contable, cuenta de gasto, distribucion de centro de costo (formato XML)' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |

## Triggers Relacionados
_Ninguno_
