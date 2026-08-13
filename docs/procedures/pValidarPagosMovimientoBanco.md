# SP: pValidarPagosMovimientoBanco
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarPagosMovimientoBanco]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
	
        DECLARE @pIdR UNIQUEIDENTIFIER
        DECLARE @pIdM UNIQUEIDENTIFIER
        DECLARE @pReng_Num INT
        DECLARE @pCob_Num CHAR(20)
        DECLARE @pDescrip VARCHAR(192)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME

	-- Coincidencia formas de pago con documentos cancelados
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                RP.rowguid AS idR, Mv.rowguid AS IdM, RP.reng_num, RP.cob_num,
                CASE WHEN ISNULL(RP.forma_pag, '') <> ISNULL(MV.tipo_op, '')
                     THEN ', Forma de Pago (' + RTRIM(ISNULL(RP.forma_pag, '')) + ' <> ' + RTRIM(ISNULL(MV.tipo_op, ''))
                          + ')'
                     ELSE ''
                END + CASE WHEN MV.monto_d <> round(RP.mont_doc/MV.tasa,2)
                           THEN ', Monto (' + CONVERT(VARCHAR, MV.monto_d) + ' <> ' + CONVERT(VARCHAR, round(RP.mont_doc/MV.tasa,2))
                                + ')'
                           ELSE ''
                      END + CASE WHEN ISNULL(MV.cod_cta, '') <> ISNULL(RP.cod_cta, '')
                                 THEN ', Codigo de la Cuenta (' + RTRIM(ISNULL(RP.cod_cta, '')) + ' <> '
                                      + RTRIM(ISNULL(MV.cod_cta, '')) + ')'
                                 ELSE ''
                            END + CASE WHEN ISNULL(Mv.origen, '') <> 'PAG'
                                       THEN ', Tipo de Origen del Movimiento (' + RTRIM(ISNULL(Mv.origen, ''))
                                            + ' <> PAG)'
                                       ELSE ''
                                  END + CASE WHEN ISNULL(Mv.cob_pag, '') <> ISNULL(RP.cob_num, '')
                                             THEN ', Origen (' + RTRIM(ISNULL(RP.cob_num, '')) + ' <> '
                                                  + RTRIM(ISNULL(MV.cob_pag, '')) + ')'
                                             ELSE ''
                                        END
                + CASE WHEN ISNULL(Mv.doc_num, '') <> ISNULL(RP.num_doc, '')
                       THEN ', Numero de Documento (' + RTRIM(ISNULL(RP.num_doc, '')) + ' <> ' + RTRIM(
```
