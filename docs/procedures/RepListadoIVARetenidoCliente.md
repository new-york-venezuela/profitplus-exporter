# SP: RepListadoIVARetenidoCliente
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05-31-21>
-- Description:	<Listado de IVA Retenido a Clientes>
-- =============================================
CREATE PROCEDURE [dbo].[RepListadoIVARetenidoCliente]
	-- Add the parameters for the stored procedure here
    @dFecha_d SMALLDATETIME = NULL ,
    @dFecha_h SMALLDATETIME = NULL ,
    @sCo_prov_d CHAR(16) = NULL ,
    @sCo_prov_h CHAR(16) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
        SELECT
            '0' AS tipo_reporte, DV.fec_emis, DV.num_comprobante, '' AS prov_ter, PDR.nro_doc AS numero, PDR.co_tipo_doc,TD.tipo_mov,
            DV.co_cli AS co_prov, P.cli_des AS prov_des, PDR1.nro_doc, PDR1.co_tipo_doc AS tipo, '' AS nro_fact,
            --wosuna Situacion 103917
			CASE WHEN TD.tipo_mov = 'CR'
			THEN -PDR.mont_cob
			ELSE
			PDR.mont_cob
			END AS mont_cob, DV.anulado
        FROM
            saCobroDocReng AS PDR
            INNER JOIN saCobroDocReng AS PDR1 ON PDR.rowguid_reng_ori = PDR1.rowguid
			INNER JOIN saTipoDocumento as TD ON PDR1.co_tipo_doc = TD.co_tipo_doc
            INNER JOIN saDocumentoVenta AS DV ON PDR.nro_doc = DV.nro_doc
                                                 AND DV.co_tipo_doc = PDR.co_tipo_doc
                                                 AND ( PDR.co_tipo_doc = 'IVAN'
                                                       OR PDR.co_tipo_doc = 'IVAP'
                                                     )
            INNER JOIN saCliente AS P ON DV.co_cli = P.co_cli
        WHERE
            ( ( @dFecha_d IS NULL
                --OR DV.fec_emis >= @dFecha_d
				--kdc : sit. #105783
				 OR CONVERT (date ,DV.fec_emis )  >=  CONVERT (date ,@dFecha_d )
              )
              AND ( @dFecha_h IS NULL
                    --OR DV.fec_emis <= @dFecha_h
					--kdc : sit. #105783
					OR CONVERT (date ,DV.fec_emis )  <=  CONVERT (date ,@dFecha_h )
                  )
            )
            AND ( ( @sCo_prov_d IS NULL
                    OR DV.co_cli >= @sCo_prov_d
                  )
                  AND ( @sCo_prov_h IS NULL
                        OR DV.co_cli <= @sCo_prov_h
                      )
                )
            AND ( @sCo_Sucursal IS NULL
                  OR @sCo_Sucursal = DV.co_sucu_in
```
