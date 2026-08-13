# SP: pValidarCobrosMovimientoCaja
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pValidarCobrosMovimientoCaja
*CREADO			: <2011-12-12>
*MODIFICADO		: <2020-07-01>
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pValidarCobrosMovimientoCaja]
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
                CASE WHEN ISNULL(RP.forma_pag, '') <> ISNULL(MV.forma_pag, '')
                     THEN ', Forma de Cobro (' + RTRIM(ISNULL(RP.forma_pag, '')) + ' <> ' + RTRIM(ISNULL(MV.forma_pag,
                                                                                                        '')) + ')'
                     ELSE ''
                END + CASE WHEN MV.monto_h  <> round(RP.mont_doc/MV.tasa,2)
                           THEN ', Monto (' + CONVERT(VARCHAR, MV.monto_h) + ' <> ' + CONVERT(VARCHAR, convert(decimal(18,2), RP.mont_doc/MV.tasa,2))
                                + ')'
                           ELSE ''
                      END + CASE WHEN ISNULL(MV.cod_caja, '') <> ISNULL(RP.cod_caja, '')
                                 THEN ', Codigo de la Caja (' + RTRIM(ISNULL(RP.cod_caja, '')) + ' <> '
                                      + RTRIM(ISNULL(MV.cod_caja, '')) + ')'
                                 ELSE ''
                            END + CASE WHEN ISNULL(Mv.origen, '') <> 'COB'
                                       THEN ', Tipo de Origen del Movimiento (' + RTRIM(ISNULL(Mv.origen, ''))
                                            + ' <> COB)'
                                       ELSE ''
                                  END
                + CASE WHEN ISNULL(Mv.doc_num, '') <> ISNULL(RP.cob_num, '')
                       THEN ', Numero de Documento (' + RTRIM(ISNULL(R
```
