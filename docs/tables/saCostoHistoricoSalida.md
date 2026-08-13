# Tabla: saCostoHistoricoSalida
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `cod_costo_historico_salida` | uniqueidentifier | NOT NULL | b'Identificador unico del registro de salida de costo' | — |
| `cod_costo_historico_entrada` | uniqueidentifier | NULL | — | FK → `saCostoHistoricoEntrada.cod_costo_historico_entrada` |
| `cod_articulo_rowguid` | uniqueidentifier | NOT NULL | b'Identificador unico del articulo relacionado (saArticulo.rowguid)' | FK → `saArticulo.rowguid` |
| `doc_orig` | uniqueidentifier | NOT NULL | b'Identificador unico del registro del cual procede (saNombreTabla.rowguid)' | — |
| `costo_pro` | decimal(18,5) | NOT NULL | b'Costo promedio' | — |
| `cantidad` | decimal(18,5) | NOT NULL | b'Cantidad de articulos' | — |
| `tipo_doc` | char(4) | NOT NULL | b'Tipo documento de origen, FACT: Factura de Venta, NENT: Nota de Entrega, DCLI: Devolucion de Cliente, COMP: Factura de Compra, NREC: Nota de Recepcion, DPRO: Devolucion a Proveedor OCOM: Orden de Compra, CPRO: Cotizacion de Compra, PCOM: Plantilla de Compra, PCLI: Pedido de CLiente, CCLI: Cotizacion a Cliente,NDES: Nota de Despacho, PVEN: Plantilla de Venta, AJUE: Ajuste de Entrada, AJUS: Ajuste de Salida, TRAE: Traslado de Entrada, TRAS: Traslado de Salida, GCOM: Generacion de Compuesto, RGEN: Renglones de Compuesto' | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |
| `fecha_emision` | datetime(23,3) | NOT NULL | b'Fecha del documento asociado a la salida' | — |
| `cod_almacen` | char(6) | NOT NULL | b'Codigo del almacen' | FK → `saAlmacen.co_alma` |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saCostoHistoricoSalida_saArticulo`: `cod_articulo_rowguid` → `saArticulo.rowguid`
- `FK_saCostoHistoricoSalida_saAlmacen`: `cod_almacen` → `saAlmacen.co_alma`
- `FK_saCostoHistoricoSalida_saCostoHistoricoEntrada`: `cod_costo_historico_entrada` → `saCostoHistoricoEntrada.cod_costo_historico_entrada`
