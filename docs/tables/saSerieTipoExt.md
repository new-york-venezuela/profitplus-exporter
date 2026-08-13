# Tabla: saSerieTipoExt
**Módulo**: Inventario
**Descripción de Negocio**: _Pendiente de enriquecimiento_

## Campos
| Campo | Tipo | Nulo | Descripción | Relación |
|---|---|---|---|---|
| `rowguid_serietipo` | uniqueidentifier | NOT NULL | — | FK → `saSerieTipo.rowguid` |
| `co_serie` | char(1) | NULL | b'C\xc3\xb3digo de la cliente de los "NCF"' | — |
| `co_negocio` | char(2) | NULL | b'C\xc3\xb3digo del \xc3\xa1rea de negocio de la serie para "NCF"' | — |
| `punto_emi` | char(3) | NULL | b'Identificador que clasifica las diferentes sucursales que posea cada divisi\xc3\xb3n del negocio para la secuencia del "NCF"' | FK → `saPuntoEmision.co_punto_emi` |
| `area_imp` | char(3) | NULL | b'Identificador de los diferentes puntos de venta por cada punto de emisi\xc3\xb3n (sucursales) que posea la divisi\xc3\xb3n del negocio para la secuencia del "NCF"' | FK → `saAreaImpresion.co_area_imp` |
| `co_tipo` | char(2) | NULL | b'Iidentificador  de tipo de Comprobante Fiscal de uso com\xc3\xban o especial, para la secuencia del "NCF"' | — |
| `fe_venc` | smalldatetime(16,0) | NOT NULL | b'Fecha Vencimiento de la Serie NCF establecida por la DGII' | — |
| `notidiavenc` | int(10,0) | NOT NULL | b'Cantidad de d\xc3\xadas establecidos para alertar al usuario sobre el vencimiento de la serie NCF' | — |
| `notifinserie` | int(10,0) | NOT NULL | b'Cantidad de correlativos disponibles para alertar al usuario sobre la culminaci\xc3\xb3n del rango de la serie NCF' | — |
| `campo1` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo2` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo3` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo4` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo5` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo6` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo7` | varchar(60) | NULL | b'Campo Adicional' | — |
| `campo8` | varchar(60) | NULL | b'Campo Adicional' | — |
| `co_us_in` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que ingres\xc3\xb3 el registro' | — |
| `co_sucu_in` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue ingresado el registro' | — |
| `fe_us_in` | datetime(23,3) | NOT NULL | b'Fecha de inserci\xc3\xb3n del registro' | — |
| `co_us_mo` | char(6) | NOT NULL | b'C\xc3\xb3digo del usuario que hizo la \xc3\xbaltima modificaci\xc3\xb3n en el registro' | — |
| `co_sucu_mo` | char(6) | NULL | b'C\xc3\xb3digo de la sucursal donde fue modificado por \xc3\xbaltima vez el registro' | — |
| `fe_us_mo` | datetime(23,3) | NOT NULL | b'Fecha de la \xc3\xbaltima modificaci\xc3\xb3n del registro' | — |
| `revisado` | char(1) | NULL | b'Reservado por el sistema' | — |
| `transfe` | char(1) | NULL | b'Reservado por el sistema' | — |
| `validador` | timestamp | NOT NULL | b'Reservado por el sistema' | — |
| `rowguid` | uniqueidentifier | NOT NULL | b'Identificador \xc3\xbanico' | — |

## Triggers Relacionados
_Ninguno_

## Foreign Keys (explícitas)
- `FK_saSerieTipoExt_saSerieTipo`: `rowguid_serietipo` → `saSerieTipo.rowguid`
- `FK_saSerieTipoExt_saAreaImpresion`: `area_imp` → `saAreaImpresion.co_area_imp`
- `FK_saSerieTipoExt_saPuntoEmision`: `punto_emi` → `saPuntoEmision.co_punto_emi`
