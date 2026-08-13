# SP: pValidarPagosMovimientoCaja
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarPagosMovimientoCaja]
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
                CASE WHEN ISNULL(RP.forma_pag, '') <> ISNULL(MV.forma_pag, '')
                     THEN ', Forma de Pago (' + RTRIM(ISNULL(RP.forma_pag, '')) + ' <> ' + RTRIM(ISNULL(MV.forma_pag, ''))
                          + ')'
                     ELSE ''
                END + CASE WHEN MV.monto_d <> round(RP.mont_doc/MV.tasa,2)
                           THEN ', Monto (' + CONVERT(VARCHAR, MV.monto_d) + ' <> ' + CONVERT(VARCHAR, round(RP.mont_doc/MV.tasa,2))
                                + ')'
                           ELSE ''
                      END + CASE WHEN ISNULL(MV.cod_caja, '') <> ISNULL(RP.cod_caja, '')
                                 THEN ', Codigo de la Caja (' + RTRIM(ISNULL(RP.cod_caja, '')) + ' <> '
                                      + RTRIM(ISNULL(MV.cod_caja, '')) + ')'
                                 ELSE ''
                            END + CASE WHEN ISNULL(Mv.origen, '') <> 'PAG'
                                       THEN ', Tipo de Origen del Movimiento (' + RTRIM(ISNULL(Mv.origen, ''))
                                            + ' <> PAG)'
                                       ELSE ''
                                  END
                + CASE WHEN ISNULL(Mv.doc_num, '') <> ISNULL(RP.cob_num, '')
                       THEN ', Numero de Documento (' + RTRIM(ISNULL(RP.cob_num, '')) + ' <> ' + RTRIM(ISNULL(MV.doc_num,
                                                                                                        '')) + ')'
                       ELSE ''
                  END AS descrip
            FROM
                saPagoTPReng RP
                INNER JOIN saMovimientoCaja MV ON MV.mov_num = RP.mov_num_c
            WHERE
```
