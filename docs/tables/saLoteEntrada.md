# Tabla: saLoteEntrada
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_reng` | uniqueidentifier | NOT NULL | b'Identificador unico del documento de origen' | — |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `tipo_doc` | char(4) | NOT NULL | b'Tipo documento de origen, FACT: Factura de Venta, NENT: Nota de Entrega, DCLI: Devolucion de Cliente, COMP: Factura de Compra, NREC: Nota de Recepcion, DPRO: Devolucion a Proveedor OCOM: Orden de Compra, CPRO: Cotizacion de Compra, PCOM: Plantilla de Compra, PCLI: Pedido de CLiente, CCLI: Cotizacion a Cliente,NDES: Nota de Despacho, PVEN: Plantilla de Venta, AJUE: Ajuste de Entrada, AJUS: Ajuste de Salida, TRAE: Traslado de Entrada, TRAS: Traslado de Salida, GCOM: Generacion de Compuesto, RGEN: Renglones de Compuesto' | — |
| `co_art` | char(30) | NOT NULL | b'Codigo del articulo' | FK → `saArticulo.co_art` |
| `co_alma` | char(6) | NOT NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |
| `numero_lote` | char(20) | NOT NULL | b'Identificador del lote' | — |
| `fecha_inicio` | smalldatetime(16,0) | NULL | b'Fecha de elaboracion/inicio del lote' | — |
| `fecha_expiracion` | smalldatetime(16,0) | NULL | b'Fecha de expiracion del lote' | — |
| `cantidad` | decimal(18,5) | NOT NULL | b'Cantidad del lote' | — |
| `stock_actual` | decimal(18,5) | NOT NULL | b'Stock disponible para el lote' | — |
| `precio` | decimal(18,5) | NOT NULL | b'Reservado para futuras implementaciones' | — |
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
- `FK_saLoteEntrada_saAlmacen`: `co_alma` → `saAlmacen.co_alma`
- `FK_saLoteEntrada_saArticulo`: `co_art` → `saArticulo.co_art`
