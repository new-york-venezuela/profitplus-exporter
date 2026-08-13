# SP: pValidarMovimientoBancoOrigen
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCobroTPReng`](../tables/saCobroTPReng.md)
- [`saDepositoBanco`](../tables/saDepositoBanco.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saOrdenPago`](../tables/saOrdenPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarMovimientoBancoOrigen]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
	
        DECLARE @pIdR UNIQUEIDENTIFIER
        DECLARE @pMov_Num CHAR(20)
        DECLARE @pOrigen CHAR(4)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME

	-- Coincidencia formas de pago con documentos cancelados
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                Mv.rowguid, Mv.mov_num, MV.origen
            FROM
                saMovimientoBanco MV
            WHERE
                MV.origen IN ( 'PAG' )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saPagoTPReng RE
                                 WHERE
                                    RE.mov_num_b IS NOT NULL
                                    AND RE.mov_num_b = MV.mov_num )
            UNION
            SELECT
                Mv.rowguid, Mv.mov_num, MV.origen
            FROM
                saMovimientoBanco MV
            WHERE
                MV.origen IN ( 'COB' )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saCobroTPReng RE
                                 WHERE
                                    RE.mov_num_b IS NOT NULL
                                    AND RE.mov_num_b = MV.mov_num )
            UNION
            SELECT
                Mv.rowguid, Mv.mov_num, MV.origen
            FROM
                saMovimientoBanco MV
            WHERE
                MV.origen IN ( 'DEP' )
                AND NOT EXISTS ( SELECT
                                    *
                                 FROM
                                    saDepositoBanco RE
                                 WHERE
                                    RE.mov_num_b IS NOT NULL
                                    AND RE.mov_num_b = MV.mov_num )
            UNION
            SELECT
                Mv.rowguid, Mv.mov_num, MV.origen
            FROM
                saMovimientoBanco MV
            WHERE
                MV.origen IN ( 'OPA' )
                AND NOT EXISTS ( SELECT
```
