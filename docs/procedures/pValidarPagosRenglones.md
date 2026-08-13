# SP: pValidarPagosRenglones
**Tipo**: Validar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPago`](../tables/saPago.md)
- [`saPagoDocReng`](../tables/saPagoDocReng.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarPagosRenglones]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValPedienteResult TABLE ( Motivo VARCHAR(256) )
        DECLARE @pCob_Num CHAR(20)
        DECLARE @Id UNIQUEIDENTIFIER
        DECLARE @pTipo CHAR(2)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME

	-- Coincidencia formas de pago con documentos cancelados
        DECLARE PENDIENTE_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                E.rowguid, E.cob_num, 'R1' AS Tipo
            FROM
                saPago E
            WHERE
                NOT EXISTS ( SELECT
                                *
                             FROM
                                saPagoDocReng R1
                             WHERE
                                R1.cob_num = E.cob_num )
            UNION
            SELECT
                E.rowguid, E.cob_num, 'R2' AS Tipo
            FROM
                saPago E
            WHERE
                NOT EXISTS ( SELECT
                                *
                             FROM
                                saPagoTPReng R2
                             WHERE
                                R2.cob_num = E.cob_num )
            ORDER BY
                2

        OPEN PENDIENTE_VALIDAR

        FETCH NEXT FROM PENDIENTE_VALIDAR INTO @Id, @pCob_Num, @pTipo

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                IF @pTipo = 'R1' 
                    SET @PistaMensaje = 'El pago nro. "' + RTRIM(@pCob_Num) + '" no posee renglones de detalle. *NC'
                ELSE 
                    SET @PistaMensaje = 'El pago nro. "' + RTRIM(@pCob_Num)
                        + '" no posee renglones de forma de pago. *NC'
		
                IF ( @bCorregir = 1
                     AND 1 = 0
                   ) 
                    BEGIN			
                        DELETE
                            saPago
                        WHERE
                            rowguid = @Id
                        SET @HoraCorrida = GETDATE()
                        EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
                            @sTablaOri = 'saPago', @rowguidOri = @Id, @sTipo_Op = N'E', @sMaquina = NULL,
                            @sCampos = @PistaMensaje
```
