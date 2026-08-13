# SP: pActualizarCostoPromedioArticuloCalcular
**Tipo**: Actualizar
**Módulo**: Inventario

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarCostoPromedioArticuloCalcular]
    (
       @strco_art CHAR(30), 
	   @strUsuario CHAR(6),
       @strMaquina CHAR(60),
	   @bTipo Bit ----- 1 Salida, 0 Entrada
    )
AS 
    BEGIN

        SET NOCOUNT ON
			
			declare @pRowguid UNIQUEIDENTIFIER
			declare @strCoArtDesde char(30)
			declare @strCoArtHasta char(30)
			declare @strCoSucu CHAR(6)
			declare @strCoAlmaDesde CHAR(6)
			declare @strCoAlmaHasta char(6)
			declare @bDeta bit

			set @strCoArtDesde = @strco_art
			set @strCoArtHasta = @strco_art
			set @strCoSucu = 'N/D' 
			set @strCoAlmaHasta = NULL
			set @strCoAlmaDesde = NULL
			set @bDeta = 0

			EXEC [pCostoPromedioCalcular] @strUsuario , @strMaquina  , @strCoSucu  , @strCoArtDesde ,
				  @strCoArtHasta  , @strCoAlmaDesde , @strCoAlmaHasta  , @bDeta

			--set @bTipo = 0
			--EXEC [pCostoPromedioCalcularRenglonAprox] @strUsuario = @strUsuario, @strMaquina =@strMaquina,-- @strCoSucu = @strCoSucu,
			--		@RowGuid_Doc_Orig = @pRowguid, @bTipo = @bTipo

	
END
```
