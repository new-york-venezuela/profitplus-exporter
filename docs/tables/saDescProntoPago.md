# Tabla: saDescProntoPago
**Módulo**: Ventas
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_desc` | char(6) | NOT NULL | — | — |
| `tip_cli` | char(6) | NOT NULL | b'C\xc3\xb3digo del tipo de cliente al cual se le aplica el descuento' | FK → `saTipoCliente.tip_cli` |
| `des_des` | varchar(60) | NOT NULL | b'Descripci\xc3\xb3n del registro o documento' | — |
| `hasta1` | decimal(18,2) | NULL | b'Cantidad Vendida nivel 1' | — |
| `hasta2` | decimal(18,2) | NULL | b'Limite superior de la segunda escala' | — |
| `hasta3` | decimal(18,2) | NULL | b'Limite superior de la tercera escala' | — |
| `hasta4` | decimal(18,2) | NULL | b'Limite superior de la cuarta escala' | — |
| `hasta5` | decimal(18,2) | NULL | b'Limite superior de la quinta escala' | — |
| `porc1` | decimal(18,2) | NULL | b'Porcentaje de la primera escala' | — |
| `porc2` | decimal(18,2) | NULL | b'Porcentaje de la segunda escala' | — |
| `porc3` | decimal(18,2) | NULL | b'Porcentaje de la tercera escala' | — |
| `porc4` | decimal(18,2) | NULL | b'Porcentaje de la cuarta escala' | — |
| `porc5` | decimal(18,2) | NULL | b'Porcentaje de la quinta escala' | — |
| `porc6` | decimal(18,2) | NULL | b'Porcentaje de la sexta escala' | — |
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
- `FK_saDescProntoPago_saTipoCliente`: `tip_cli` → `saTipoCliente.tip_cli`
