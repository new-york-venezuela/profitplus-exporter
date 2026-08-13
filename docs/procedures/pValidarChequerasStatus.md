# SP: pValidarChequerasStatus
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarChequerasStatus]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN    
       
       
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pCoChequera CHAR(6)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @bPuedeCorregir BIT
        DECLARE @pEstatus CHAR(3)
        DECLARE @pValorOld INT
        DECLARE @pValorNew INT
        DECLARE @pTotalEMI INT
        DECLARE @pTotalANU INT
        DECLARE @pTotalDIS INT

       -- -- Error en numero de cheques NC o actualizar numero de cheques (chequera emitida cheques)
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                *
            FROM
                ( SELECT
                    E.rowguid, E.co_chra, E.status, E.num_ch, SUM(CASE WHEN co_cheq IS NULL THEN 0
                                                                       ELSE 1
                                                                  END) AS TotalCheq
                  FROM
                    saChequera E
                    LEFT JOIN saCheque R ON E.co_chra = R.co_chra
                  GROUP BY
                    E.rowguid, E.co_chra, E.num_ch, E.status
                ) A
            WHERE
                ( TotalCheq <> num_ch
                  AND TotalCheq > 0
                ) 


        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Id, @pCoChequera, @pEstatus, @pValorOld, @pValorNew
        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PistaMensaje = 'La chequera "' + RTRIM(@pCoChequera) + '" tiene definido en número de cheques '
                    + RTRIM(STR(@pValorOld)) + ' y tiene generado ' + RTRIM(STR(@pValorNew)) + ' .'

               SET @bPuedeCorregir = 0

                IF ( @bCorregir = 1
                     --AND @bPuedeCorregir = 1
                   ) 
                    BEGIN               
                        UPDATE
                            saChequera
                        SET num_ch = @pValorNew
                        WHERE
                            rowguid = @Id
                        SET @HoraCorrida = GETDATE()
                        EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @
```
