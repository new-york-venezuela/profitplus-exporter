# SP: pValidarPendientePlantillaCompraReng
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarPendientePlantillaCompraReng]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )

        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                F.doc_num, F.reng_num, F.pendiente AS pedienteOld, F.total_art AS pedienteNew, F.rowguid
            FROM
                saPlantillaCompraReng F
            WHERE
                F.pendiente <> F.total_art 

        OPEN PENDIENTE_VALIDAR

        DECLARE @pDoc_Num CHAR(20)
        DECLARE @pReng_num INT
        DECLARE @pPendienteNew DECIMAL(18, 5)
        DECLARE @pPendienteOld DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @pDoc_Num, @pReng_num, @pPendienteOld, @pPendienteNew, @Id

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PistaMensaje = 'La plantilla de compra nro. "' + RTRIM(@pDoc_Num) + '" renglon "'
                    + LTRIM(RTRIM(STR(@pReng_num))) + '" tiene pendiente "' + LTRIM(RTRIM(STR(@pPendienteOld, 18, 5)))
                    + '" y el correcto es "' + LTRIM(RTRIM(STR(@pPendienteNew, 18, 5))) + '"'

                IF ( @bCorregir = 1 ) 
                    BEGIN
                        UPDATE
                            saPlantillaCompraReng
                        SET pendiente = @pPendienteNew
                        WHERE
                            rowguid = @Id
                        SET @HoraCorrida = GETDATE()
                        EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                            @sTablaOri = 'saPlantillaCompraReng', @rowguidOri = @Id, @sTipo_Op = N'M', @sMaquina = NULL,
                            @sCampos = @PistaMensaje
                    END


                SET @HoraCorrida = GETDATE()
                EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                    @sTablaOri = 'saPlantillaCompraReng', @rowguidOri = @IdProcess, @sTipo_Op = N'M', @sMaquina = NULL,
                    @sCampos = @PistaMensaje

                INSERT  INTO @ValPedienteResult
                        ( Motivo )
                VALUES
```
