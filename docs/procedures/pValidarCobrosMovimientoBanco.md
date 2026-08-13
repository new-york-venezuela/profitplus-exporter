# SP: pValidarCobrosMovimientoBanco
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarCobrosMovimientoBanco]
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

	-- Coincidencia formas de Cobro con documentos cancelados
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                RP.rowguid AS idR, Mv.rowguid AS IdM, RP.reng_num, RP.cob_num,
                CASE WHEN ISNULL(RP.forma_pag, '') <> ISNULL(MV.tipo_op, '')
                     THEN ', Forma de Cobro (' + RTRIM(ISNULL(RP.forma_pag, '')) + ' <> ' + RTRIM(ISNULL(MV.tipo_op, ''))
                          + ')'
                     ELSE ''
                END + CASE WHEN CASE WHEN MV.monto_d = 0 THEN MV.monto_h
                                     ELSE MV.monto_d
                                END <> round(RP.mont_doc/MV.tasa,2)
                           THEN ', Monto (' + CONVERT(VARCHAR, CASE WHEN MV.monto_d = 0 THEN MV.monto_h
                                                                    ELSE MV.monto_d
                                                               END) + ' <> ' + CONVERT(VARCHAR, round(RP.mont_doc/MV.tasa,2)) + ')'
                           ELSE ''
                      END + CASE WHEN ISNULL(MV.cod_cta, '') <> ISNULL(RP.cod_cta, '')
                                 THEN ', Codigo de la Cuenta (' + RTRIM(ISNULL(RP.cod_cta, '')) + ' <> '
                                      + RTRIM(ISNULL(MV.cod_cta, '')) + ')'
                                 ELSE ''
                            END + CASE WHEN ISNULL(Mv.origen, '') <> 'COB'
                                       THEN ', Tipo de Origen del Movimiento (' + RTRIM(ISNULL(Mv.origen, ''))
                                            + ' <> COB)'
                                       ELSE ''
                                  END + CASE WHEN ISNULL(Mv.cob_pag, '') <> ISNULL(RP.cob_num, '')
                                             THEN ', Origen (' + RTRIM(ISNULL(RP.cob_num, '')) + ' <> '
                                                  + RTRIM(ISNULL(MV.cob_pag, '')) + ')'
```
