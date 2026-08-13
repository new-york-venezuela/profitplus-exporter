# SP: RepFormatoChequeEmitidoCob
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <08-02-11>
 Description:	<Formato de Cheque Emitido>
 =============================================*/
CREATE PROCEDURE [RepFormatoChequeEmitidoCob]
	-- Add the parameters for the stored procedure here
    @sCo_Pag_d CHAR(20) = NULL ,
    @sCo_Pag_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'

        IF ( @sCampOrderBy IS NULL ) 
            SET @sCampOrderBy = 'cob_doc'	

        SELECT
            'Documentos a Cobrar' AS tipo, 
			P.cob_num, 
			ISNULL(dbo.MontoEscrito(PTR.mont_doc), 0) AS MontoEscrito,
            PTR.num_doc, 
			PTR.mont_doc, 
			PTR.fecha_che, DC.co_tipo_doc, 
			PDR.nro_doc  AS nro_fact, DC.total_neto, PDR.mont_cob,
            CB.cod_cta, CB.num_cta, B.des_ban, PR.cli_des AS prov_des
        FROM
            saCobro AS P
            INNER JOIN saCobroTPReng AS PTR ON PTR.cob_num = P.cob_num
            INNER JOIN saCobroDocReng AS PDR ON PDR.cob_num = P.cob_num
            LEFT JOIN saDocumentoVenta AS DC ON (DC.nro_doc = PDR.nro_doc and DC.co_tipo_doc = PDR.co_tipo_doc)
            LEFT JOIN saCuentaBancaria AS CB ON CB.cod_cta = PTR.cod_cta
            LEFT JOIN saBanco AS B ON B.co_ban = CB.co_ban
            INNER JOIN saCliente AS PR ON PR.co_cli = P.co_cli
        WHERE
            ( ( @sCo_Pag_d IS NULL
                OR P.cob_num >= @sCo_Pag_d
              )
              AND ( @sCo_Pag_h IS NULL
                    OR P.cob_num <= @sCo_Pag_h
                  )
            )
            AND ( @sCo_Sucursal IS NULL
                  OR P.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            p.cob_num DESC

    END
```
