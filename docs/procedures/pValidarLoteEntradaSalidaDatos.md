# SP: pValidarLoteEntradaSalidaDatos
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pValidarLoteEntradaSalidaDatos]
    (
      @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
      @IdProcess UNIQUEIDENTIFIER
    )
AS 
    BEGIN	
	
        DECLARE @ValStatusResult TABLE ( Motivo VARCHAR(512) )
        DECLARE @CoArtL CHAR(30)
        DECLARE @CoArtR CHAR(30)
        DECLARE @CoAlmaL CHAR(6)
        DECLARE @CoAlmaR CHAR(6)
        DECLARE @NumeroLoteL CHAR(20)
        DECLARE @NumeroLoteR CHAR(20)


        DECLARE CURSOR_VALIDAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT
                LS.rowguid, LS.co_art, ISNULL(LE.co_art, '') AS co_artE, LS.co_alma, ISNULL(LE.co_alma, '') AS co_almaE,
                LS.numero_lote, ISNULL(LE.numero_lote, '') AS numero_loteE
            FROM
                saLoteSalida LS
                LEFT JOIN saLoteEntrada LE ON LS.Rowguid_lote = LE.rowguid
            WHERE
                LS.co_art <> ISNULL(LE.co_art, '')
                OR LS.co_alma <> ISNULL(LE.co_alma, '')
                OR LS.numero_lote <> ISNULL(LE.numero_lote, '')
                OR LE.co_art IS NULL
            ORDER BY
                LS.numero_lote

        OPEN CURSOR_VALIDAR

        DECLARE @pMotivo VARCHAR(512)
        DECLARE @PistaMensaje AS VARCHAR(MAX)
        DECLARE @HoraCorrida DATETIME
        DECLARE @Id UNIQUEIDENTIFIER

        FETCH NEXT FROM CURSOR_VALIDAR INTO @Id, @CoArtL, @CoArtR, @CoAlmaL, @CoAlmaR, @NumeroLoteL, @NumeroLoteR

        WHILE @@FETCH_STATUS = 0 
            BEGIN
                IF @CoArtR = '' 
                    SET @PistaMensaje = 'El lote de salida ' + RTRIM(CONVERT(VARCHAR(64), @Id))
                        + ' no tiene lote se entrada *NC.' 
                ELSE 
                    BEGIN
                        SET @PistaMensaje = 'El lote de salida ' + RTRIM(CONVERT(VARCHAR(64), @Id))
                            + ' tiene valores distintos al lote de entrada *NC.' 
                        IF @CoArtL <> @CoArtR 
                            SET @PistaMensaje = @PistaMensaje + 'Co_Art: ' + RTRIM(@CoArtL) + '<>' + RTRIM(@CoArtR)

                        IF @CoAlmaL <> @CoAlmaR 
                            SET @PistaMensaje = @PistaMensaje + 'Co_Alma: ' + RTRIM(@CoAlmaL) + '<>' + RTRIM(@CoAlmaR)

                        IF @NumeroLoteL <> @NumeroLoteR 
                            SET @PistaMensaje = @PistaMensaje + 'Numero_Lote: ' + RTRIM(@NumeroLoteL) + '<>'
```
