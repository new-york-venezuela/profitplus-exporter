# Tabla: saIntegr
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `inte_num` | char(20) | NOT NULL | b'N\xc3\xbamero de integraci\xc3\xb3n.' | — |
| `fec_emis` | smalldatetime(16,0) | NULL | b'Fecha de emision' | — |
| `desde` | smalldatetime(16,0) | NOT NULL | b'Fecha  de inicio de la integraci\xc3\xb3n.' | — |
| `hasta` | smalldatetime(16,0) | NOT NULL | b'Fecha final de la integraci\xc3\xb3n.' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `des_inte` | varchar(60) | NULL | b'Descripci\xc3\xb3n de la integraci\xc3\xb3n.' | — |
| `docnoint` | bit(1,0) | NOT NULL | b'Documentos no integrados. Identificador de que se realizar\xc3\xa1 la integraci\xc3\xb3n en aquellos documentos no  integrados con anterioridad.' | — |
| `marcar` | bit(1,0) | NOT NULL | b'Marcar. Identificador que los documentos se marcar\xc3\xa1n como contabilizados.' | — |
| `val_cuad` | bit(1,0) | NOT NULL | b'Validar cuadrado. Identificador de que se validar\xc3\xa1 si el comprobante se encuentra cuadrado o no.' | — |
| `compxfec` | bit(1,0) | NOT NULL | b'Comprobante por fecha. Identificador de que el comprobante de integraci\xc3\xb3n se generar\xc3\xa1  por fecha.' | — |
| `compxtip` | bit(1,0) | NOT NULL | b'Comprobante por tipo. Identificador de que el comprobante de integraci\xc3\xb3n se generar\xc3\xa1 por tipo de documento.' | — |
| `criterio` | int(10,0) | NOT NULL | b'Criterio de Costeo. Identificador de que el criterio que se va ha utilizar en la contabilizaci\xc3\xb3n es por: 1(costo promedio) o  2(\xc3\xbaltimo costo) o 3 (UEPS_PEPS).' | — |
| `agrupam` | int(10,0) | NOT NULL | b'Agrupamiento.Identificador de que la contabilizaci\xc3\xb3n se agrupar\xc3\xa1 por: 1(ninguno),2(inventario) o 5(global).' | — |
| `compras` | bit(1,0) | NOT NULL | b'Compras. Identificador de que se procesar\xc3\xa1n los documentos de compras .' | — |
| `pagos` | bit(1,0) | NOT NULL | b'Pagos. Identificador de que se procesar\xc3\xa1n los documentos de pagos .' | — |
| `dev_pro` | bit(1,0) | NOT NULL | b'Devoluciones de proveedores.Identificador de que se procesar\xc3\xa1n los documentos de las devoluciones de proveedores. .' | — |
| `ncr_pro` | bit(1,0) | NOT NULL | b'Nota de credito de proveedores.Identificador de que se procesar\xc3\xa1n los documentos de  las notas de creditos de proveedores .' | — |
| `ndb_pro` | bit(1,0) | NOT NULL | b'Nota de debito de proveedores. Identificador de que se procesar\xc3\xa1n los documentos de las notas de debito de proveedores. ' | — |
| `gir_pro` | bit(1,0) | NOT NULL | b'Giros de proveedores.Identificador de que se procesar\xc3\xa1n los documentos de los giros de los proveedores.' | — |
| `chdev_pro` | bit(1,0) | NOT NULL | b'Cheques devueltos de proveedores. Identificador de que se procesar\xc3\xa1n los documentos de los cheques devueltos de proveedores.' | — |
| `ventas` | bit(1,0) | NOT NULL | b'Ventas.Identificador de que se procesar\xc3\xa1n los documentos de ventas.' | — |
| `cobros` | bit(1,0) | NOT NULL | b'Cobros.Identificador de que se procesar\xc3\xa1n los documentos de cobros .' | — |
| `dev_cli` | bit(1,0) | NOT NULL | b'Devoluci\xc3\xb3n de clientes.Identificador de que se procesar\xc3\xa1n los documentos de las devoluciones de clientes.' | — |
| `ncr_cli` | bit(1,0) | NOT NULL | b'Notas de cr\xc3\xa9dito del cliente. Identificador de que se procesar\xc3\xa1n los documentos de las notas de cr\xc3\xa9dito del cliente .' | — |
| `ndb_cli` | bit(1,0) | NOT NULL | b'Notas de debito del cliente. Identificador de que se procesar\xc3\xa1n los documentos de las notas de debito del cliente .' | — |
| `gir_cli` | bit(1,0) | NOT NULL | b'Giros del cliente. Identificador de que se procesar\xc3\xa1n los documentos de los giros del  clientes.' | — |
| `chdev_cli` | bit(1,0) | NOT NULL | b'Cheques devueltos del cliente. Identificador de que se procesar\xc3\xa1n los documentos de los cheques devueltos del cliente .' | — |
| `ord_pago` | bit(1,0) | NOT NULL | b'Orden de pago. Identificador de que se procesar\xc3\xa1n los comprobantes de las ordenes de pago .' | — |
| `mov_caja` | bit(1,0) | NOT NULL | b'Movimientos de caja. Identificador de que se procesar\xc3\xa1n los documentos de los movimientos de caja .' | — |
| `mov_banco` | bit(1,0) | NOT NULL | b'Movimientos de banco.Identificador de que se procesar\xc3\xa1n los documentos de los movimientos de banco .' | — |
| `ajustes` | bit(1,0) | NOT NULL | b'Ajustes. Identificador de que se procesar\xc3\xa1n los documentos de ajuste.' | — |
| `not_ent` | bit(1,0) | NOT NULL | b'Notas de entrega.Identificador de que se procesar\xc3\xa1n los documentos de las notas de entrega.' | — |
| `com_gen` | bit(1,0) | NOT NULL | b'Compuestos Generados. Identificador de que procesar\xc3\xa1n los documentos de  compuestos generados.' | — |
| `nomina` | bit(1,0) | NOT NULL | b'Nomina.Identificador de que se procesar\xc3\xa1n los  documentos generados por la nomina.' | — |
| `not_rec` | bit(1,0) | NOT NULL | b'Notas de recepci\xc3\xb3n.Identificador de que se procesar\xc3\xa1n los documentos de notas de recepci\xc3\xb3n .' | — |
| `todos` | bit(1,0) | NOT NULL | b'Todos.Identificador de que se procesar\xc3\xa1n todos los tipos de documentos.' | — |
| `act_ultf` | bit(1,0) | NOT NULL | b'Actualizar \xc3\xbaltima fecha de integraci\xc3\xb3n.Identificador de que se actualizar\xc3\xa1 la fecha de la \xc3\xbaltima integraci\xc3\xb3n .' | — |
| `placom` | bit(1,0) | NOT NULL | b'Plantillas de Compras Identificador de que se proser\xc3\xa1n los documentos de plantillas de compras' | — |
| `plavent` | bit(1,0) | NOT NULL | b'Plantillas de Venta Identificador de que se proser\xc3\xa1n los documentos de plantillas de ventas' | — |
| `ajupr` | bit(1,0) | NOT NULL | b'Doc. de ajustes proveedores Identificador de que se proser\xc3\xa1n los documentos de Doc. de ajustes prov.' | — |
| `ajucl` | bit(1,0) | NOT NULL | b'Doc. de ajustes clientes Identificador de que se proser\xc3\xa1n los documentos de Doc. de ajustes clientes' | — |
| `tras_alm` | bit(1,0) | NOT NULL | b'Traslados entre almacenes Identificador de que se proser\xc3\xa1n los documentos de traslados entre almacen' | — |
| `pedidos` | bit(1,0) | NOT NULL | b'Pedidos Identificador de que se proser\xc3\xa1n los documentos de pedidos' | — |
| `ordenes` | bit(1,0) | NOT NULL | b'Ordenes de compra Identificador de que se proser\xc3\xa1n los documentos de Ordenes de compra' | — |
| `co_sucu_desde` | char(6) | NULL | b'valor de la sucursal. Por defecto \xe2\x80\x9cTodos\xe2\x80\x9d y guarda null en el campo' | FK → `saSucursal.co_sucur` |
| `co_sucu_hasta` | char(6) | NULL | — | FK → `saSucursal.co_sucur` |
| `co_cont_desde` | char(12) | NULL | b'Valor del contrato. Por defecto \xe2\x80\x9cTodos\xe2\x80\x9d y guarda null en el campo.' | — |
| `co_cont_hasta` | char(12) | NULL | — | — |
| `ajustexdif` | bit(1,0) | NOT NULL | b'Generar rengl\xc3\xb3n de ajuste por diferencia. Valores: Si/No ' | — |
| `orden` | int(10,0) | NOT NULL | b'Ordenar por Tipo - Doc Ref. - Fecha /  Fecha \xe2\x80\x93 Tipo \xe2\x80\x93 Doc Ref. Valores: 0 Tipo - Doc Ref. - Fecha 1 Fecha \xe2\x80\x93 Tipo \xe2\x80\x93 Doc' | — |
| `auxiliar_nom` | bit(1,0) | NOT NULL | b'Contabilizar Nomina con auxiliar \xe2\x80\x9cO\xe2\x80\x9d (Beneficiario). Valores: Si/No' | — |
| `co_sucu_in` | char(6) | NULL | — | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_sucu_mo` | char(6) | NULL | — | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saIntegr_saSucursal_co_sucu_desde`: `co_sucu_desde` → `saSucursal.co_sucur`
- `FK_saIntegr_saSucursal_co_sucu_hasta`: `co_sucu_hasta` → `saSucursal.co_sucur`
