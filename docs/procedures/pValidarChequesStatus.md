# SP: pValidarChequesStatus
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarChequesStatus]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN     
       
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pCoCheq CHAR(20)
              DECLARE @pMovNum CHAR(20)
              DECLARE @pMovNumOri CHAR(20)
        DECLARE @pCoChequera CHAR(6)
        DECLARE @pCoFecha SMALLDATETIME
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @bPuedeCorregir BIT
        DECLARE @pEstatus CHAR(3)


-- cheque presente en dos movimeintos
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                CH.rowguid, ch.co_cheq, ch.co_chra, ch.fec_ent, CH.status, CH.mov_num
            FROM
                saCheque CH
                     WHERE CH.rowguid in 
              (SELECT
                ch.rowguid
            FROM
                saCheque CH
                INNER JOIN saChequera CHR ON CHR.co_chra = CH.co_chra
                           INNER JOIN saMovimientoBanco MB ON  MB.cod_cta = CHR.cod_cta
                                    AND MB.tipo_op = 'CH'
                                    AND CH.co_cheq = MB.doc_num
                     Group by ch.rowguid
                     Having count(*) > 1
              )

        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Id, @pCoCheq, @pCoChequera, @pCoFecha, @pEstatus,@pMovNum
        WHILE @@FETCH_STATUS = 0 
            BEGIN

                           SET @PistaMensaje = 'El cheque "' + RTRIM(@pCoCheq) + '" de la chequera "' + RTRIM(@pCoChequera)
                                         + '" esta asociado a mas de un movimiento *NC'

                SET @HoraCorrida = GETDATE()
                EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                    @sTablaOri = 'saCheque', @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = NULL,
                    @sCampos = @PistaMensaje

                INSERT  INTO @ValPedienteResult
                        ( Motivo )
                VALUES
                        ( @PistaMensaje )
                FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Id, @pCoCheq, @pCoChequera, @pCoFecha,@pEstatus,@pMovNum
            END 
        CLOSE PENDIENTE_VALIDAR
```
