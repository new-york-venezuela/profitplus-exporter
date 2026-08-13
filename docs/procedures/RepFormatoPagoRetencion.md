# SP: RepFormatoPagoRetencion
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/02/2011>
-- Description:	<Reporte de Formato de Pago Retención>
-- =============================================
CREATE PROCEDURE [RepFormatoPagoRetencion]
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
            '0' AS numero, PG.fecha, P.co_prov, P.prov_des, P.rif, P.nit, P.telefonos, P.fax, P.direc1,
            P.direc2 AS dir_entrega, PG.cob_num, PG.co_mone, PDR1.reng_num AS reng_doc, PDR1.co_tipo_doc, PDR1.nro_doc,
            PDR1.nro_fact, PDR.mont_cob, PDR.co_tipo_doc AS forma_pag, PDR.nro_doc AS num_doc, '' AS num_cta,
            '' AS fecha_che, 0.00 AS mont_doc, '' AS codigo, TP.descrip AS descripcion, '' AS co_ban, '' AS des_ban,
            TP.tipo_mov
        FROM
            saPagoDocReng AS PDR
            INNER JOIN saPagoDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
                                                AND ( PDR.co_tipo_doc = 'IVAN'
                                                      OR PDR.co_tipo_doc = 'IVAP'
                                                      OR PDR.co_tipo_doc = 'ISLR'
                                                    )
            INNER JOIN saPago AS PG ON PG.cob_num = PDR1.cob_num
                                       AND PG.anulado = 0
            INNER JOIN saTipoDocumento AS TP ON TP.co_tipo_doc = PDR.co_tipo_doc
            INNER JOIN saProveedor AS P ON pg.co_prov = P.co_prov
        WHERE
            ( ( @sCo_Numero_d IS NULL
                OR PG.cob_num >= @sCo_Numero_d
              )
              AND ( @sCo_Numero_h IS NULL
                    OR PG.cob_num <= @sCo_Numero_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR @sCo_Sucursal = Pg.co_sucu_in
                )
	
    END
```
