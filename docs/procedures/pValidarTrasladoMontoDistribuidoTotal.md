# SP: pValidarTrasladoMontoDistribuidoTotal
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saTraslado`](../tables/saTraslado.md)
- [`saTrasladoReng`](../tables/saTrasladoReng.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarTrasladoMontoDistribuidoTotal]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS  
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(256) )

        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                E.tras_num, E.rowguid, E.monto_dist, ( SELECT
                                                        SUM(ROUND(R.costo_adi1 * R.total_art, 2))
                                                       FROM
                                                        saTrasladoReng R
                                                       WHERE
                                                        R.tras_num = E.tras_num
                                                     ) AS monto_distReal
            FROM
                saTraslado E
            WHERE
                E.monto_dist <> ( SELECT
                                    SUM(ROUND(R.costo_adi1 * R.total_art, 2))
                                  FROM
                                    saTrasladoReng R
                                  WHERE
                                    R.tras_num = E.tras_num
                                )

        OPEN CURSOR_VALIDAR

        DECLARE @pTras_Num CHAR(20)
        DECLARE @pMonto_DistOld DECIMAL(18, 5)
        DECLARE @pMonto_DistNew DECIMAL(18, 5)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER

        FETCH NEXT FROM CURSOR_VALIDAR 	INTO @pTras_Num, @Id, @pMonto_DistOld, @pMonto_DistNew

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                SET @PistaMensaje = 'El traslado nro. "' + RTRIM(@pTras_Num) + '" tiene como monto a distribuir "'
                    + CONVERT(VARCHAR, @pMonto_DistOld) + '" y la suma de los montos a nivel de renglon es "'
                    + CONVERT(VARCHAR, @pMonto_DistNew) + '"'

                IF ( @bCorregir = 1 ) 
                    BEGIN
                        UPDATE
                            saTraslado
                        SET monto_dist = @pMonto_DistNew
                        WHERE
                            tras_num = @pTras_Num
                        SET @HoraCorrida = GETDATE()
                        EXEC [pInsertarPista] @sUsuario_Id = 'VALCON', @dtFecha = @HoraCorrida, @sCo_Sucu = NULL,
```
