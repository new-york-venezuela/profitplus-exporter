# SP: RepFormatoCobro
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/02/2011>
-- Modified date: <2017-11-25>
-- Description:	<Reporte de Formato de Cobro>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoCobro]
    @sCo_Numero_d CHAR(20) = NULL ,
    @sCo_Numero_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        SELECT
            *
        FROM
            ( SELECT
                '0' AS numero, Pa.fecha, P.co_cli AS co_prov, P.cli_des AS prov_des, P.rif, P.nit, P.telefonos, P.fax,
                P.direc1, P.direc2 AS dir_entrega, Pa.cob_num, Pa.co_mone, Pa.descrip, PR.reng_num AS reng_doc, PR.co_tipo_doc,
                PR.nro_doc, '' AS nro_fact, PR.mont_cob, '' AS forma_pag, '' AS num_doc, '' AS num_cta, NULL AS fecha_che,
                DC.total_neto AS mont_doc, '' AS codigo, '' AS descripcion, '' AS co_ban, '' AS des_ban, TP.tipo_mov
              FROM
                saCobro AS Pa
                INNER JOIN saCobroDocReng AS PR ON PR.cob_num = Pa.cob_num
                                                   AND Pa.anulado = 0
                INNER JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = PR.co_tipo_doc
                INNER JOIN saCliente AS P ON P.co_cli = Pa.co_cli
				INNER JOIN saDocumentoVenta AS DC on DC.co_tipo_doc = PR.co_tipo_doc and DC.nro_doc = PR.nro_doc
              WHERE
                ( ( @sCo_Numero_d IS NULL
                    OR Pa.cob_num >= @sCo_Numero_d
                  )
                  AND ( @sCo_Numero_h IS NULL
                        OR Pa.cob_num <= @sCo_Numero_h
                      )
                )
                AND ( @sCo_Sucursal IS NULL
                      OR @sCo_Sucursal = Pa.co_sucu_in
                    )
              UNION ALL
              SELECT
                '1' AS numero, Pa.fecha, P.co_cli AS co_prov, P.cli_des AS prov_des, P.rif, P.nit, P.telefonos, P.fax,
                P.direc1, P.direc2 AS dir_entrega, Pa.cob_num, Pa.co_mone, Pa.descrip, PT.reng_num AS reng_doc, '' AS co_tipo_doc,
                '' AS nro_doc, '' AS nro_fact, 0.00 AS mont_cob, PT.forma_pag, PT.num_doc, C.num_cta, PT.fecha_che,
                PT.mont_doc, 
				case 
					when Pt.forma_pag ='DP' then isnull(C.cod_cta, '') 
					when Pt.forma_pag ='TP' the
```
