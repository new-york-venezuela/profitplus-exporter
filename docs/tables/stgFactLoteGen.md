# Tabla: stgFactLoteGen
**Módulo**: Staging
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `co_fact_lote_gen` | char(6) | NOT NULL | b'C\xc3\xb3digo del proceso de facturaci\xc3\xb3n por lotes.' | — |
| `descrip` | varchar(60) | NULL | b'Descripci\xc3\xb3n del registro o documento' | — |
| `fecha` | datetime(23,3) | NOT NULL | — | — |
| `procesado` | bit(1,0) | NOT NULL | b'Indica si el registro fue procesado.' | — |
| `co_cli_d` | char(16) | NULL | b'c\xc3\xb3digo de cliente que servir\xc3\xa1 como filtro del rango de clientes que se seleccionar\xc3\xa1.' | FK → `saCliente.co_cli` |
| `co_cli_h` | char(16) | NULL | b'c\xc3\xb3digo de cliente que servir\xc3\xa1 como filtro del rango de clientes que se seleccionar\xc3\xa1.' | FK → `saCliente.co_cli` |
| `co_serie_fact` | char(20) | NOT NULL | b'C\xc3\xb3digo de la serie que se utilizar\xc3\xa1 para asignar el nro de factura' | FK → `saSerie.co_serie` |
| `co_serie_nctrl` | char(20) | NOT NULL | b'C\xc3\xb3digo de la serie que se utilizar\xc3\xa1 para asignar el nro de control de factura' | FK → `saSerie.co_serie` |
| `man_ven_pl` | bit(1,0) | NOT NULL | b'Indica si se le asignar\xc3\xa1 c\xc3\xb3digo de vendedor a todos los documentos generados.' | — |
| `man_cond_pl` | bit(1,0) | NOT NULL | b'Indica si se le asignar\xc3\xa1 c\xc3\xb3digo de condici\xc3\xb3n de pago a todos los documentos generados.' | — |
| `fec_emis` | smalldatetime(16,0) | NOT NULL | b'Fecha de emision' | — |
| `fec_venc` | smalldatetime(16,0) | NOT NULL | b'Fecha de vencimiento' | — |
| `fec_reg` | smalldatetime(16,0) | NOT NULL | b'Fecha de registro' | — |
| `man_fec_emis` | bit(1,0) | NOT NULL | b'Indica si se le asignar\xc3\xa1 fecha de emisi\xc3\xb3n a todos los documentos generados.' | — |
| `man_fec_venc` | bit(1,0) | NOT NULL | b'Indica si se le asignar\xc3\xa1 fecha de vencimiento a todos los documentos generados.' | — |
| `man_fec_reg` | bit(1,0) | NOT NULL | b'Indica si se le asignar\xc3\xa1 fecha de registro a todos los documentos generados.' | — |
| `prec_vta_act` | bit(1,0) | NOT NULL | b'Indica si se asignar\xc3\xa1 a los renglones el precio de venta actual o el que tiene la plantilla.' | — |
| `co_usuario` | char(6) | NOT NULL | b'C\xc3\xb3digo de usuario con el que crear\xc3\xa1n las facturas.' | — |
| `co_sucu` | char(6) | NULL | b'C\xc3\xb3digo de sucursal en la que se crear\xc3\xa1n las facturas.' | — |
| `co_plan_vta` | char(20) | NULL | b'C\xc3\xb3digo de la plantilla de venta en la que se basar\xc3\xa1 el proceso para crear las facturas.' | FK → `saPlantillaVenta.doc_num` |
| `sp_usuario` | char(128) | NULL | b'Nombre del store procedure que se utilizar\xc3\xa1 para conseguir el rango de clientes.' | — |
| `arch_cod` | char(260) | NULL | b'Ruta del archivo de c\xc3\xb3digo que se compilar\xc3\xa1 durante la ejecuaci\xc3\xb3n del proceso para manipular los objetos de factura.' | — |
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
| `revisado` | char(1) | NULL | — | — |
| `trasnfe` | char(1) | NULL | — | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saLotesFactGen_saSerieFact`: `co_serie_fact` → `saSerie.co_serie`
- `FK_saLotesFactGen_saSerieNctrl`: `co_serie_nctrl` → `saSerie.co_serie`
- `FK_stgFactLoteGen_saClienteD`: `co_cli_d` → `saCliente.co_cli`
- `FK_stgFactLoteGen_saClienteH`: `co_cli_h` → `saCliente.co_cli`
- `FK_stgFactLoteGen_saPlantillaVenta`: `co_plan_vta` → `saPlantillaVenta.doc_num`
