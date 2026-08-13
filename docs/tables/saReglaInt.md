# Tabla: saReglaInt
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_reg` | char(10) | NOT NULL | b'C\xc3\xb3digo de la regla de integraci\xc3\xb3n.' | — |
| `des_reg` | varchar(60) | NULL | b'Descripci\xc3\xb3n de la regla de integraci\xc3\xb3n.' | — |
| `tipo` | char(4) | NOT NULL | b'Tipo de documento involucrado en la regla de integraci\xc3\xb3n.' | — |
| `inactivo` | bit(1,0) | NOT NULL | b'Indicativo de registro inactivo' | — |
| `debehaber` | int(10,0) | NOT NULL | b'Destino. Identificador de que el monto se coloque por el debe o haber de la cuenta.1(Debe), 2(Haber).' | — |
| `aplica` | varchar(max) | NULL | b'Aplicar cuando. Expresi\xc3\xb3n que refleja en que momento se debe aplicar la regla.' | — |
| `monto` | varchar(max) | NULL | b'Monto. Expresi\xc3\xb3n que refleja el monto del asiento contable.' | — |
| `gasto` | varchar(max) | NULL | b'Cuenta de Gasto.Expresi\xc3\xb3n en donde se determina el c\xc3\xb3digo de la cuenta de gastos  asociada a la regla de integraci\xc3\xb3n.' | — |
| `distri` | varchar(max) | NULL | b'Distribuci\xc3\xb3n por centro de costo.Expresi\xc3\xb3n que determina la distribuci\xc3\xb3n por el centro de costo asociado a la regla de integraci\xc3\xb3n.' | — |
| `descrip` | varchar(max) | NULL | b'Descripci\xc3\xb3n del asiento.Expresi\xc3\xb3n en donde se coloca la descripci\xc3\xb3n del asiento.' | — |
| `cuenta` | varchar(max) | NULL | b'C\xc3\xb3digo de la cuenta contable. Expresi\xc3\xb3n en donde se selecciona el c\xc3\xb3digo de la cuenta asociada a la regla de integraci\xc3\xb3n.' | — |
| `encabezado` | varchar(max) | NULL | b'Expresi\xc3\xb3n en donde se selecciona el c\xc3\xb3digo de la cuenta asociada a la regla de integraci\xc3\xb3n.' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `version` | char(4) | NULL | b'Campo que indica la versi\xc3\xb3n en la cual fue creada la regla de integraci\xc3\xb3n.' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
- `TrigEstado_saReglaInt`
