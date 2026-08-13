# Tabla: saDepositoBancoReng
**Módulo**: Tesorería
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `dep_num` | char(20) | NOT NULL | b'N\xc3\xbamero del dep\xc3\xb3sito bancario' | FK → `saDepositoBanco.dep_num` |
| `reng_num` | int(10,0) | NOT NULL | b'Numero de Renglon' | — |
| `codigo` | char(6) | NOT NULL | b'C\xc3\xb3digo del Banco asociado al movimiento' | FK → `saCaja.cod_caja` |
| `mov_afec_c` | char(20) | NOT NULL | b'Movimiento que afecta' | FK → `saMovimientoCaja.mov_num` |
| `mov_gene_c` | char(20) | NULL | b'Numero de movimiento de caja generado en el deposito' | FK → `saMovimientoCaja.mov_num` |
| `monto` | decimal(18,5) | NOT NULL | b'Monto de la operaci\xc3\xb3n' | — |
| `comision` | decimal(18,2) | NOT NULL | b'Comisi\xc3\xb3n total de las tarjetas que se est\xc3\xa1n depositando' | — |
| `porc_comision` | decimal(18,5) | NOT NULL | — | — |
| `porc_impuesto` | decimal(18,5) | NOT NULL | — | — |
| `impuesto` | decimal(18,2) | NOT NULL | b'Impuesto total de las tarjetas que se est\xc3\xa1n depositando' | — |
| `tipo_plazo` | char(1) | NULL | b'1 = Mismo Banco, Misma Plaza, 2 = Mismo Banco, Diferente Plaza, 3 = Diferente Banco, Misma Plaza, 4 = Diferente Banco, Diferente Plaza' | — |
| `feccom` | smalldatetime(16,0) | NULL | b'Informacion Contable: fecha de procesamiento en contabilidad' | — |
| `numcom` | int(10,0) | NULL | b'Informacion Contable: numero de comprobante de contabilidad asociado' | — |
| `co_us_in` | char(6) | NOT NULL | b'Codigo del usuario que ingreso el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'Codigo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de insercion del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'Codigo del usuario que hizo la ultima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'Codigo de la sucursal donde fue modificado por ultima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la ultima modificacion del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `trasnfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador Unico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saDepositoBancoReng_saCaja`: `codigo` → `saCaja.cod_caja`
- `FK_saDepositoBancoReng_saDepositoBanco`: `dep_num` → `saDepositoBanco.dep_num`
- `FK_saDepositoBancoReng_saMovimientoCajaAfec`: `mov_afec_c` → `saMovimientoCaja.mov_num`
- `FK_saDepositoBancoReng_saMovimientoCajaGene`: `mov_gene_c` → `saMovimientoCaja.mov_num`
