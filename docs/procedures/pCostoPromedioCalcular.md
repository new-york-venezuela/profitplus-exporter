# SP: pCostoPromedioCalcular
**Tipo**: Procedimiento
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saCostoHistoricoSalida`](../tables/saCostoHistoricoSalida.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pCostoPromedioCalcular]
    (
      @strUsuario CHAR(6) = 'N/D' ,
      @strMaquina CHAR(60) = 'N/D' ,
      @strCoSucu CHAR(6) = 'N/D' ,
      @strCoArtDesde CHAR(30) = NULL ,
      @strCoArtHasta CHAR(30) = NULL ,
      @strCoAlmaDesde CHAR(6) = NULL ,
      @strCoAlmaHasta CHAR(6) = NULL ,
      @bDetalle BIT = 0
    )
AS 
    BEGIN

        SET NOCOUNT ON

        DECLARE @IdCorrida UNIQUEIDENTIFIER
        DECLARE @HoraCorrida DATETIME
        DECLARE @PistaMensaje AS VARCHAR(MAX)

        SET @IdCorrida = NEWID()

        IF ( @strCoArtDesde IS NOT NULL ) 
            IF ( RTRIM(@strCoArtDesde) = '' ) 
                SET @strCoArtDesde = NULL

        IF ( @strCoArtHasta IS NOT NULL ) 
            IF ( RTRIM(@strCoArtHasta) = '' ) 
                SET @strCoArtHasta = NULL

        IF ( @strCoAlmaDesde IS NOT NULL ) 
            IF ( RTRIM(@strCoAlmaDesde) = '' ) 
                SET @strCoAlmaDesde = NULL

        IF ( @strCoAlmaHasta IS NOT NULL ) 
            IF ( RTRIM(@strCoAlmaHasta) = '' ) 
                SET @strCoAlmaHasta = NULL


-- Pista de Inicio del Proceso
        SET @HoraCorrida = GETDATE()
        SET @PistaMensaje = 'Iniciando proceso calculo costo promedio. Articulo[' + RTRIM(ISNULL(@strCoArtDesde, ''))
            + ':' + RTRIM(ISNULL(@strCoArtHasta, '')) + '], Almacen[' + RTRIM(ISNULL(@strCoAlmaDesde, '')) + ':'
            + RTRIM(ISNULL(@strCoAlmaHasta, '')) + ']'
		DECLARE @iCpro AS int = isnull( (select count(value) from sys.extended_properties where NAME = 'CPRO'),0)            
        EXEC [pInsertarPista] @sUsuario_Id = @strUsuario, @dtFecha = @HoraCorrida, @sCo_Sucu = @strCoSucu,
            @sTablaOri = 'CalculaCostoPromedio', @rowguidOri = @IdCorrida, @sTipo_Op = N'I', @sMaquina = @strMaquina,
            @sCampos = @PistaMensaje


-- Se lleva a cero los costos de salida de aquellos articulos/almacen que no tengan entradas asociadas
        UPDATE
            dbo.saCostoHistoricoSalida
        SET costo_pro = 0
        WHERE
            costo_pro <> 0
            AND ( @strCoArtDesde IS NULL
                  OR @strCoArtDesde <= ( SELECT
                                            A.co_art
                                         FROM
                                            saArticulo A
                                         WHERE
                                            A.rowguid = dbo.saCostoHistoricoSalida.cod_articulo
```
