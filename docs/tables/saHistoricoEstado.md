# Tabla: saHistoricoEstado
**Módulo**: Configuración
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |
| `doc_orig` | uniqueidentifier | NOT NULL | b'Id del documento de origen' | — |
| `tipo_doc` | char(24) | NOT NULL | b'Tipo documento de origen, FACT: Factura de Venta, NENT: Nota de Entrega, DCLI: Devolucion de Cliente, COMP: Factura de Compra, NREC: Nota de Recepcion, DPRO: Devolucion a Proveedor OCOM: Orden de Compra, CPRO: Cotizacion de Compra, PCOM: Plantilla de Compra, PCLI: Pedido de CLiente, CCLI: Cotizacion a Cliente,NDES: Nota de Despacho, PVEN: Plantilla de Venta, AJUE: Ajuste de Entrada, AJUS: Ajuste de Salida, TRAE: Traslado de Entrada, TRAS: Traslado de Salida, GCOM: Generacion de Compuesto, RGEN: Renglones de Compuesto' | — |
| `estado` | char(4) | NOT NULL | — | — |
| `fecha` | datetime(23,3) | NOT NULL | — | — |
| `validador` | timestamp | NOT NULL | b'Marca de tiempo usada en el control de concurrencia' | — |

## Triggers Relacionados
_Ninguno_
