# SP: RepFormatoPagoMultiplesMonedas
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCaja`](../tables/saCaja.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/02/2011>
-- Last Update date: <2020-12-08>
-- Description:	<Reporte de Formato de Pago de Multiples Monedas>
-- =============================================
CREATE PROCEDURE [dbo].[RepFormatoPagoMultiplesMonedas]
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
            (  SELECT
                '0' AS numero, Pa.fecha, P.co_prov, P.prov_des, P.rif, P.nit, P.telefonos, P.fax, P.direc1,
                P.direc2 AS dir_entrega, Pa.cob_num, Pa.co_mone, Pa.descrip, PR.reng_num AS reng_doc, PR.co_tipo_doc, PR.nro_doc,
                ISNULL(PR.nro_fact, '') AS nro_fact, PR.mont_cob / Pa.tasa AS mont_cob, '' AS forma_pag, '' AS num_doc,
                '' AS num_cta, '' AS fecha_che, DC.total_neto AS mont_doc, '' AS codigo, '' AS descripcion, '' AS co_ban,
                '' AS des_ban, TP.tipo_mov, null as monto_h_banco,null as co_mone_banco,  null as monto_h_caja, NULL as co_mone_caja, NULL as tasa_banco, NULL as tasa_caja
              FROM
                saPago AS Pa
                INNER JOIN sapagodocreng AS PR ON PR.cob_num = Pa.cob_num AND Pa.anulado = 0
                INNER JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = PR.co_tipo_doc
                INNER JOIN saProveedor AS P ON P.co_prov = Pa.co_prov
			    INNER JOIN saDocumentoCompra AS DC ON DC.nro_doc = PR.nro_doc AND  DC.co_tipo_doc = PR.co_tipo_doc
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
                '1' AS numero, Pa.fecha, P.co_prov, P.prov_des, P.rif, P.nit, P.telefonos, P.fax, P.direc1,
                P.direc2 AS dir_entrega, Pa.cob_num, Pa.co_mone, Pa.descrip, PT.reng_num AS reng_doc, '' AS co_tipo_doc,
                '' AS nro_doc, '' AS nro_fact, 0.00 AS mont_cob, PT.forma_pag, PT.num_doc, C.num_cta, PT.fecha_che,
```
