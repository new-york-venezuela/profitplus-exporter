# SP: pValidarCobrosCalculo
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarCobrosCalculo]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN    
       
	    SET NOCOUNT ON

        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @pCob_Num CHAR(20)
        DECLARE @pValorOld DECIMAL(18, 5)
        DECLARE @pValorNew DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME

		DECLARE @bFiltrarReconv BIT
        Select Top 1 @bFiltrarReconv = [v_reconv] From [par_emp]


       -- Coincidencia formas de Cobro con documentos cancelados
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                ENC.cob_num, DOCS.MontoDoc, FormasCobro.MontoFormasCobro
            FROM
                saCobro ENC
                LEFT JOIN ( SELECT
                                E.cob_num, SUM(R.mont_cob * CASE WHEN TDOC.tipo_mov = 'CR' THEN -1
                                                                 WHEN TDOC.tipo_mov = 'DE' THEN 1
                                                                 ELSE 0
                                                            END) AS MontoDoc
                            FROM
                                saCobro E
                                INNER JOIN saCobroDocReng R ON E.cob_num = R.cob_num
                                INNER JOIN saTipoDocumento TDOC ON TDOC.co_tipo_doc = R.co_tipo_doc
								WHERE @bFiltrarReconv = 0 or ((@bFiltrarReconv = 1 and E.campo8 not like '<RECONV18>%') and (@bFiltrarReconv = 1 and E.campo8 not like '<RECONV21>%'))
                            GROUP BY
                                E.cob_num
                          ) DOCS ON DOCS.cob_num = ENC.cob_num
                LEFT JOIN ( SELECT
                                E.cob_num, ISNULL(SUM(RFP.mont_doc), 0.00) AS MontoFormasCobro
                            FROM
                                saCobro E
                                LEFT JOIN saCobroTpReng RFP ON E.cob_num = RFP.cob_num
                            GROUP BY
                                E.cob_num
                          ) FormasCobro ON FormasCobro.cob_num = ENC.cob_num
            WHERE
                DOCS.MontoDoc <> FormasCobro.MontoFormasCobro
                AND ENC.cob_num NOT IN ( -- Adelantos se excluyen de la validacion
                SELECT
```
